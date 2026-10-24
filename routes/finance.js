const express = require('express');
const db = require('../config/db');
const requireAdmin = require('../middleware/requireAdmin');

const router = express.Router();
router.use(requireAdmin);

const invoiceFields = {
  invoice_number: 'invoice_number', project_id: 'project_id', client_name: 'client_name',
  client_email: 'client_email', invoice_date: 'invoice_date', due_date: 'due_date',
  currency: 'currency', subtotal: 'subtotal', tax_amount: 'tax_amount',
  discount_amount: 'discount_amount', total_amount: 'total_amount',
  manual_paid_amount: 'manual_paid_amount', status: 'status',
  description: 'description', notes: 'notes',
};
const transactionFields = {
  transaction_type: 'transaction_type', transaction_date: 'transaction_date', amount: 'amount',
  currency: 'currency', category_id: 'category_id', project_id: 'project_id',
  party_name: 'party_name', payment_method: 'payment_method', reference: 'reference',
  description: 'description', notes: 'notes',
};

function assignmentsFrom(body, fields) {
  const entries = Object.entries(fields).filter(([key]) => key in body);
  return {
    entries,
    assignments: entries.map(([, column]) => `${column} = ?`).join(', '),
    values: entries.map(([key]) => body[key] === '' ? null : body[key]),
  };
}

router.get('/summary/company', async (req, res) => {
  try {
    const [rows] = await db.query('select * from public.company_financial_summary');
    res.json(rows[0] || {});
  } catch (error) {
    res.status(500).json({ error: 'Could not load company finance summary' });
  }
});

router.get('/summary/projects', async (req, res) => {
  try {
    const [rows] = await db.query('select * from public.project_financial_summary order by project_name');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Could not load project finance summaries' });
  }
});

router.get('/summary/monthly', async (req, res) => {
  try {
    const [rows] = await db.query('select * from public.monthly_cash_flow order by month desc');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Could not load monthly cash flow' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      `select id, name, transaction_type, is_active from public.finance_categories
        where is_active = true order by transaction_type, name`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Could not load finance categories' });
  }
});

router.get('/invoices', async (req, res) => {
  try {
    const [rows] = await db.query(
      `select * from public.invoice_balances order by invoice_date desc, id desc`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Could not load invoices' });
  }
});

router.post('/invoices', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.invoice_number || !body.client_name || body.total_amount == null) {
      return res.status(400).json({ error: 'Invoice number, client name, and total amount are required.' });
    }
    const [result] = await db.query(
      `insert into public.invoices
       (invoice_number, project_id, client_name, client_email, invoice_date, due_date,
        currency, subtotal, tax_amount, discount_amount, total_amount,
        manual_paid_amount, status, description, notes)
       values (?, ?, ?, ?, coalesce(?::date, current_date), ?::date, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [body.invoice_number, body.project_id || null, body.client_name, body.client_email || null,
        body.invoice_date || null, body.due_date || null, body.currency || 'BDT',
        body.subtotal ?? body.total_amount, body.tax_amount || 0, body.discount_amount || 0,
        body.total_amount, body.manual_paid_amount || 0, body.status || 'sent',
        body.description || null, body.notes || null]
    );
    const [rows] = await db.query('select * from public.invoice_balances where id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ error: 'Could not create invoice' });
  }
});

router.patch('/invoices/:id', async (req, res) => {
  try {
    const { entries, assignments, values } = assignmentsFrom(req.body || {}, invoiceFields);
    if (!entries.length) return res.status(400).json({ error: 'No invoice fields provided.' });
    values.push(req.params.id);
    await db.query(`update public.invoices set ${assignments} where id = ?`, values);
    const [rows] = await db.query('select * from public.invoice_balances where id = ?', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Invoice not found.' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Could not update invoice' });
  }
});

router.delete('/invoices/:id', async (req, res) => {
  try {
    const [result] = await db.query('delete from public.invoices where id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Invoice not found.' });
    res.json({ message: 'Invoice deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not delete invoice' });
  }
});

router.get('/transactions', async (req, res) => {
  try {
    const [rows] = await db.query(
      `select t.*, c.name as category, p.name as project_name
         from public.financial_transactions t
         left join public.finance_categories c on c.id = t.category_id
         left join public.projects p on p.id = t.project_id
        order by t.transaction_date desc, t.id desc`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Could not load transactions' });
  }
});

router.post('/transactions', async (req, res) => {
  try {
    const body = req.body || {};
    if (!['income', 'expense'].includes(body.transaction_type) || Number(body.amount) <= 0) {
      return res.status(400).json({ error: 'Choose income or expense and provide a positive amount.' });
    }
    if (body.category_id) {
      const [categories] = await db.query(
        'select id from public.finance_categories where id = ? and transaction_type = ? and is_active = true',
        [body.category_id, body.transaction_type]
      );
      if (!categories.length) return res.status(400).json({ error: 'Category does not match transaction type.' });
    }
    const [result] = await db.query(
      `insert into public.financial_transactions
       (transaction_type, transaction_date, amount, currency, category_id, project_id,
        party_name, payment_method, reference, description, notes)
       values (?, coalesce(?::date, current_date), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [body.transaction_type, body.transaction_date || null, Number(body.amount), body.currency || 'BDT',
        body.category_id || null, body.project_id || null, body.party_name || null,
        body.payment_method || null, body.reference || null, body.description || null, body.notes || null]
    );
    const [rows] = await db.query(
      `select t.*, c.name as category, p.name as project_name
         from public.financial_transactions t
         left join public.finance_categories c on c.id = t.category_id
         left join public.projects p on p.id = t.project_id where t.id = ?`, [result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Could not create transaction' });
  }
});

router.patch('/transactions/:id', async (req, res) => {
  try {
    const { entries, assignments, values } = assignmentsFrom(req.body || {}, transactionFields);
    if (!entries.length) return res.status(400).json({ error: 'No transaction fields provided.' });
    values.push(req.params.id);
    await db.query(`update public.financial_transactions set ${assignments} where id = ?`, values);
    const [rows] = await db.query(
      'select * from public.financial_transactions where id = ?', [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Transaction not found.' });
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Could not update transaction' });
  }
});

router.delete('/transactions/:id', async (req, res) => {
  try {
    const [result] = await db.query('delete from public.financial_transactions where id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Transaction not found.' });
    res.json({ message: 'Transaction deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not delete transaction' });
  }
});

module.exports = router;
