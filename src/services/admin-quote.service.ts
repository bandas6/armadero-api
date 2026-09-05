import { Quote } from '../models/quote.model.js';
import { NotFoundError } from '../lib/errors.js';
import { resolveWhatsappNumber } from '../lib/whatsapp.js';
import type { QuoteListQuery } from '../schemas/admin-quote.schema.js';

export async function listQuotes(query: QuoteListQuery) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.q) {
    filter.$or = [
      { code: { $regex: query.q, $options: 'i' } },
      { customerName: { $regex: query.q, $options: 'i' } },
      { customerCity: { $regex: query.q, $options: 'i' } },
    ];
  }

  const skip = (query.page - 1) * query.pageSize;
  const [items, total] = await Promise.all([
    Quote.find(filter)
      .select('code customerName customerCity total hasCustomItems status source items createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.pageSize)
      .lean(),
    Quote.countDocuments(filter),
  ]);

  return {
    items: items.map((q) => ({
      _id: String(q._id),
      code: q.code,
      customerName: q.customerName,
      customerCity: q.customerCity,
      total: q.total,
      hasCustomItems: q.hasCustomItems,
      status: q.status,
      source: q.source,
      itemCount: q.items?.length ?? 0,
      createdAt: q.createdAt,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function getQuote(id: string) {
  const quote = await Quote.findById(id).lean();
  if (!quote) throw new NotFoundError('No encontramos esta cotización.');
  const whatsappNumber = await resolveWhatsappNumber();
  return { ...quote, whatsappNumber };
}

export async function updateQuote(id: string, patch: { status?: string; adminNotes?: string }) {
  const quote = await Quote.findById(id);
  if (!quote) throw new NotFoundError('No encontramos esta cotización.');
  if (patch.status !== undefined) quote.status = patch.status as typeof quote.status;
  if (patch.adminNotes !== undefined) quote.adminNotes = patch.adminNotes;
  await quote.save();
  return quote;
}

export async function getQuoteStats() {
  const since = new Date();
  since.setMonth(since.getMonth() - 5, 1);
  since.setHours(0, 0, 0, 0);

  const [byMonth, topProducts, openCount, monthCount] = await Promise.all([
    Quote.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
          count: { $sum: 1 },
          won: { $sum: { $cond: [{ $eq: ['$status', 'WON'] }, 1, 0] } },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]),
    Quote.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.sku',
          name: { $first: '$items.productName' },
          count: { $sum: '$items.quantity' },
          quotes: { $sum: 1 },
        },
      },
      { $sort: { quotes: -1, count: -1 } },
      { $limit: 8 },
    ]),
    Quote.countDocuments({ status: { $in: ['NEW', 'CONTACTED'] } }),
    Quote.countDocuments({
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      },
    }),
  ]);

  return {
    byMonth: byMonth.map((r) => ({
      month: `${r._id.y}-${String(r._id.m).padStart(2, '0')}`,
      count: r.count,
      won: r.won,
    })),
    topProducts: topProducts.map((r) => ({
      sku: r._id,
      name: r.name,
      count: r.count,
      quotes: r.quotes,
    })),
    openCount,
    monthCount,
  };
}
