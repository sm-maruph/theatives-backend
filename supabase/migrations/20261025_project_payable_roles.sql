-- Adds a structured role/team label to every assigned project cost item.
-- Run this once in Supabase Dashboard > SQL Editor for an existing database.

alter table public.project_payables
  add column if not exists role text not null default '';

create or replace view public.project_payable_balances
with (security_invoker = true) as
select ob.id, ob.payee_id, pe.name as payee_name, ob.project_id, pr.name as project_name,
  ob.title, ob.amount_due, ob.due_date, ob.notes, ob.created_at,
  coalesce(sum(t.amount), 0)::numeric(14, 2) as paid_amount,
  greatest(ob.amount_due - coalesce(sum(t.amount), 0), 0)::numeric(14, 2) as remaining_balance,
  case when coalesce(sum(t.amount), 0) >= ob.amount_due then 'paid'
       when coalesce(sum(t.amount), 0) > 0 then 'partial' else 'unpaid' end as payment_status,
  ob.role
from public.project_payables ob
join public.payees pe on pe.id = ob.payee_id
join public.projects pr on pr.id = ob.project_id
left join public.financial_transactions t on t.payable_id = ob.id and t.transaction_type = 'expense'
group by ob.id, pe.name, pr.name, ob.role;
