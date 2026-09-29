import { Router } from 'express';
import { requireAuth } from './middleware/auth';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import settingsRoutes from './modules/settings/settings.routes';
import partiesRoutes from './modules/parties/parties.routes';
import labourRoutes from './modules/labour/labour.routes';
import purchasesRoutes from './modules/purchases/purchases.routes';
import expenseCategoryRoutes from './modules/expenses/categories.routes';
import expensesRoutes from './modules/expenses/expenses.routes';
import paymentsRoutes from './modules/payments/payments.routes';
import ledgerRoutes from './modules/ledger/ledger.routes';
import daybookRoutes from './modules/daybook/daybook.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';

const api = Router();

api.get('/health', (_req, res) => {
  res.json({ ok: true });
});
api.use('/auth', authRoutes);

api.use(requireAuth);
api.use('/users', usersRoutes);
api.use('/settings', settingsRoutes);
api.use('/parties', partiesRoutes);
api.use('/labour', labourRoutes);
api.use('/purchases', purchasesRoutes);
api.use('/expense-categories', expenseCategoryRoutes);
api.use('/expenses', expensesRoutes);
api.use('/payments', paymentsRoutes);
api.use('/ledger', ledgerRoutes);
api.use('/daybook', daybookRoutes);
api.use('/dashboard', dashboardRoutes);

export default api;
