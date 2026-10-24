const express = require('express');
const db = require('../config/db');
const requireAdmin = require('../middleware/requireAdmin');
const { encryptField, decryptField } = require('../utils/fieldEncryption');

const router = express.Router();
router.use(requireAdmin);

const fieldMap = {
  name: 'name', category: 'category', kind: 'kind',
  clientName: 'client_name', clientEmail: 'client_email',
  clientEmailPassword: 'client_email_password', clientPhone: 'client_phone',
  clientOtherInfo: 'client_other_info', requirements: 'requirements',
  finalPrice: 'final_price', status: 'status', startDate: 'start_date',
  deliveryDate: 'delivery_date', domain: 'domain', domainRegistrar: 'domain_registrar',
  domainCost: 'domain_cost', domainRenewal: 'domain_renewal',
  hostProvider: 'host_provider', hostCost: 'host_cost', hostRenewal: 'host_renewal',
  nextUpgrade: 'next_upgrade', nextUpgradeInfo: 'next_upgrade_info',
  upgradeCost: 'upgrade_cost', notes: 'notes',
};

const toProject = (row) => ({
  id: Number(row.id), name: row.name, category: row.category, kind: row.kind,
  clientName: row.client_name || '', clientEmail: row.client_email || '',
  clientEmailPassword: decryptField(row.client_email_password),
  clientPhone: row.client_phone || '', clientOtherInfo: row.client_other_info || '',
  requirements: row.requirements || '', finalPrice: Number(row.final_price || 0),
  amountPaid: Number(row.received_cash || 0), status: row.status,
  startDate: row.start_date || '', deliveryDate: row.delivery_date || '',
  domain: row.domain || '', domainRegistrar: row.domain_registrar || '',
  domainCost: Number(row.domain_cost || 0), domainRenewal: row.domain_renewal || '',
  hostProvider: row.host_provider || '', hostCost: Number(row.host_cost || 0),
  hostRenewal: row.host_renewal || '', nextUpgrade: row.next_upgrade || '',
  nextUpgradeInfo: row.next_upgrade_info || '', upgradeCost: Number(row.upgrade_cost || 0),
  notes: row.notes || '', updatedAt: row.updated_at, updateCount: row.update_count,
  invoicedValue: Number(row.invoiced_value || 0),
  accountsReceivable: Number(row.accounts_receivable || 0),
  totalProjectExpenses: Number(row.total_project_expenses || 0),
  profit: Number(row.profit || 0), profitLabel: row.profit_label,
});

async function getProject(id) {
  const [rows] = await db.query(
    `select p.*, s.received_cash, s.invoiced_value, s.accounts_receivable,
            s.total_project_expenses, s.profit, s.profit_label
       from public.projects p
       left join public.project_financial_summary s on s.project_id = p.id
      where p.id = ?`, [id]
  );
  return rows[0] ? toProject(rows[0]) : null;
}

router.get('/projects', async (req, res) => {
  try {
    const [rows] = await db.query(
      `select p.*, s.received_cash, s.invoiced_value, s.accounts_receivable,
              s.total_project_expenses, s.profit, s.profit_label
         from public.projects p
         left join public.project_financial_summary s on s.project_id = p.id
        order by p.created_at desc`
    );
    res.json(rows.map(toProject));
  } catch (error) {
    console.error('Could not fetch projects:', error.message);
    res.status(500).json({ error: 'Could not fetch projects' });
  }
});

router.post('/projects', async (req, res) => {
  try {
    const body = req.body || {};
    if (!String(body.name || '').trim() || !String(body.category || '').trim()) {
      return res.status(400).json({ error: 'Project name and category are required.' });
    }
    const values = [
      body.name.trim(), body.category, body.kind || 'service', body.clientName || null,
      body.clientEmail || null, encryptField(body.clientEmailPassword), body.clientPhone || null,
      body.clientOtherInfo || null, body.requirements || null, Number(body.finalPrice || 0),
      body.status || 'Active', body.startDate || null, body.deliveryDate || null,
      body.domain || null, body.domainRegistrar || null, Number(body.domainCost || 0),
      body.domainRenewal || null, body.hostProvider || null, Number(body.hostCost || 0),
      body.hostRenewal || null, body.nextUpgrade || null, body.nextUpgradeInfo || null,
      Number(body.upgradeCost || 0), body.notes || null,
    ];
    const [result] = await db.query(
      `insert into public.projects
       (name, category, kind, client_name, client_email, client_email_password,
        client_phone, client_other_info, requirements, final_price, status, start_date,
        delivery_date, domain, domain_registrar, domain_cost, domain_renewal,
        host_provider, host_cost, host_renewal, next_upgrade, next_upgrade_info,
        upgrade_cost, notes)
       values (${values.map(() => '?').join(', ')})`, values
    );
    res.status(201).json(await getProject(result.insertId));
  } catch (error) {
    console.error('Could not create project:', error.message);
    res.status(500).json({ error: 'Could not create project' });
  }
});

router.put('/projects/:id', async (req, res) => {
  try {
    const entries = Object.entries(fieldMap).filter(([key]) => key in (req.body || {}));
    if (!entries.length) return res.status(400).json({ error: 'No project fields provided.' });
    const values = entries.map(([key]) => {
      const value = req.body[key];
      if (key === 'clientEmailPassword') return encryptField(value);
      if (['finalPrice', 'domainCost', 'hostCost', 'upgradeCost'].includes(key)) return Number(value || 0);
      return value === '' ? null : value;
    });
    values.push(req.params.id);
    const assignments = entries.map(([, column]) => `${column} = ?`).join(', ');
    await db.query(`update public.projects set ${assignments} where id = ?`, values);
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    res.json(project);
  } catch (error) {
    console.error('Could not update project:', error.message);
    res.status(500).json({ error: 'Could not update project' });
  }
});

router.delete('/projects/:id', async (req, res) => {
  try {
    const [result] = await db.query('delete from public.projects where id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Project not found.' });
    res.json({ message: 'Project deleted.' });
  } catch (error) {
    const conflict = error.code === '23503';
    res.status(conflict ? 409 : 500).json({
      error: conflict ? 'This project has invoices or transactions and cannot be deleted.' : 'Could not delete project',
    });
  }
});

router.get('/project-categories', async (req, res) => {
  try {
    const [rows] = await db.query('select id, name, kind from public.project_categories order by kind, name');
    res.json(rows.map((row) => ({ ...row, id: Number(row.id) })));
  } catch (error) {
    res.status(500).json({ error: 'Could not fetch project categories' });
  }
});

router.post('/project-categories', async (req, res) => {
  try {
    const { name, kind } = req.body || {};
    if (!String(name || '').trim() || !['service', 'micro'].includes(kind)) {
      return res.status(400).json({ error: 'A category name and valid kind are required.' });
    }
    const [result] = await db.query(
      'insert into public.project_categories (name, kind) values (?, ?)', [name.trim(), kind]
    );
    const [rows] = await db.query('select id, name, kind from public.project_categories where id = ?', [result.insertId]);
    res.status(201).json({ ...rows[0], id: Number(rows[0].id) });
  } catch (error) {
    res.status(error.code === '23505' ? 409 : 500).json({ error: 'Could not create category' });
  }
});

router.delete('/project-categories/:id', async (req, res) => {
  try {
    const [result] = await db.query('delete from public.project_categories where id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Category not found.' });
    res.json({ message: 'Category deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Could not delete category' });
  }
});

module.exports = router;
