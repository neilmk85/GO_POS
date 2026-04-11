import cron from 'node-cron';
import { generateDueRecurringExpenses } from './services/expense.service';

export function startScheduler(): void {
  // Run every day at 06:00 AM
  cron.schedule('0 6 * * *', async () => {
    console.log('[Scheduler] Running recurring expense generation...');
    try {
      const count = await generateDueRecurringExpenses();
      if (count > 0) {
        console.log(`[Scheduler] Generated ${count} recurring expense(s)`);
      } else {
        console.log('[Scheduler] No recurring expenses due today');
      }
    } catch (err) {
      console.error('[Scheduler] Error generating recurring expenses:', err);
    }
  });

  console.log('[Scheduler] Recurring expense scheduler started (runs daily at 06:00)');
}
