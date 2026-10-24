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
  transaction_type: 'transaction_type', transaction_date: 'transaction_date', transaction_at: 'transaction_at', amount: 'amount',
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

router.get('/payees', async (req, res) => {
  try {
    const [rows] = await db.query('select * from public.payee_balances order by name');
    res.json(rows);
  } catch (error) { res.status(500).json({ error: 'Could not load payees' }); }
});

router.post('/payees', async (req, res) => {
  try {
    const { name, email, phone, notes } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Person name is required.' });
    const [result] = await db.query(
      'insert into public.payees (name, email, phone, notes) values (?, ?, ?, ?)',
      [String(name).trim(), email || null, phone || null, notes || null]
    );
    const [rows] = await db.query('select * from public.payee_balances where id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) { res.status(500).json({ error: 'Could not create payee' }); }
});

router.get('/payables', async (req, res) => {
  try {
    const [rows] = await db.query('select * from public.project_payable_balances order by created_at desc, id desc');
    res.json(rows);
  } catch (error) { res.status(500).json({ error: 'Could not load project payables' }); }
});

router.post('/payables', async (req, res) => {
  try {
    const { payee_id, project_id, title, amount_due, due_date, notes } = req.body || {};
    if (!payee_id || !project_id || !title || !Number.isFinite(Number(amount_due)) || Number(amount_due) <= 0) {
      return res.status(400).json({ error: 'Person, project, title, and a positive amount are required.' });
    }
    const [result] = await db.query(
      `insert into public.project_payables (payee_id, project_id, title, amount_due, due_date, notes)
       values (?, ?, ?, ?, ?::date, ?)`,
      [payee_id, project_id, String(title).trim(), Number(amount_due), due_date || null, notes || null]
    );
    const [rows] = await db.query('select * from public.project_payable_balances where id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) { res.status(500).json({ error: 'Could not add project payable' }); }
});

router.post('/payables/:id/payments', async (req, res) => {
  let client;
  try {
    const { amount, transaction_date, transaction_at, payment_method, reference, notes } = req.body || {};
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Enter a positive payment amount.' });
    }
    client = await db.pool.connect();
    await client.query('begin');
    const obligation = await client.query(
      `select ob.*, pe.name as payee_name from public.project_payables ob
       join public.payees pe on pe.id=ob.payee_id where ob.id=$1 for update of ob`, [req.params.id]
    );
    if (!obligation.rowCount) { await client.query('rollback'); return res.status(404).json({ error: 'Payable not found.' }); }
    const item = obligation.rows[0];
    const paid = await client.query(
      `select coalesce(sum(amount),0) as paid from public.financial_transactions
       where payable_id=$1 and transaction_type='expense'`, [item.id]
    );
    const remaining = Number(item.amount_due) - Number(paid.rows[0].paid);
    if (paymentAmount > remaining + 0.001) {
      await client.query('rollback');
      return res.status(400).json({ error: `Payment exceeds the remaining balance of ${remaining.toFixed(2)}.` });
    }
    const category = await client.query(
      `select id from public.finance_categories where transaction_type='expense' and is_active=true
       order by case when name='Freelancer' then 0 else 1 end, id limit 1`
    );
    await client.query(
      `insert into public.financial_transactions
       (transaction_type, transaction_date, transaction_at, amount, currency, category_id,
        project_id, payable_id, party_name, payment_method, reference, description, notes)
       values ('expense', coalesce($1::date, current_date), coalesce($2::timestamptz, now()),
        $3, 'BDT', $4, $5, $6, $7, $8, $9, $10, $11)`,
      [transaction_date || null, transaction_at || null, paymentAmount, category.rows[0]?.id || null, item.project_id,
        item.id, item.payee_name, payment_method || null, reference || null,
        `Payment: ${item.title}`, notes || null]
    );
    await client.query('commit');
    const balance = await client.query('select * from public.project_payable_balances where id=$1', [item.id]);
    res.status(201).json(balance.rows[0]);
  } catch (error) {
    if (client) await client.query('rollback').catch(() => {});
    res.status(500).json({ error: 'Could not record payable payment' });
  } finally { client?.release(); }
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
       (transaction_type, transaction_date, transaction_at, amount, currency, category_id, project_id,
        party_name, payment_method, reference, description, notes)
       values (?, coalesce(?::date, current_date), coalesce(?::timestamptz, now()), ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [body.transaction_type, body.transaction_date || null, body.transaction_at || null, Number(body.amount), body.currency || 'BDT',
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
