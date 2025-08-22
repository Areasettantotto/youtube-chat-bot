// Helper to manage periodic exhausted users announcements
export function startPeriodicAnnouncements({ intervalMs = 45000, getExhaustedUsers, formatMessage, sendMessage, logger, maxUsersDisplay = 10, attemptsKey = 'MAX_ATTEMPTS', enableLogs = false, attemptsExhaustedLogFile }) {
  let timer = null;
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      logger?.debug && logger.debug('Periodic timer tick: checking exhausted users');
      const exhaustedUsers = await getExhaustedUsers();
      logger?.debug && logger.debug(`Found ${exhaustedUsers.length} exhausted users`);
      if (exhaustedUsers.length > 0) {
        const usersList = exhaustedUsers.slice(-maxUsersDisplay).join(', ');
        const remainingCount = exhaustedUsers.length > maxUsersDisplay ? exhaustedUsers.length - maxUsersDisplay : 0;
        let announcementMessage;
        if (remainingCount > 0) {
          announcementMessage = formatMessage('periodicExhaustedAnnouncement', { usersList, remainingCount, MAX_ATTEMPTS: attemptsKey });
        } else {
          announcementMessage = formatMessage('periodicExhaustedAnnouncementSimple', { usersList, MAX_ATTEMPTS: attemptsKey });
        }

        await sendMessage(announcementMessage, 'PERIODIC_EXHAUSTED_ANNOUNCEMENT');
        logger?.success && logger.success(`Periodic announcement sent for ${exhaustedUsers.length} exhausted users`);

        if (enableLogs && attemptsExhaustedLogFile) {
          const fs = await import('fs');
          for (const author of exhaustedUsers) {
            fs.appendFileSync(attemptsExhaustedLogFile, `[${new Date().toISOString()}] Exhausted attempts announced (periodic) to ${author}\n`);
          }
        }
      }
    } catch (err) {
      logger?.error && logger.error(`Error in periodic exhausted announcement: ${err.message || JSON.stringify(err)}`);
    }
  }

  function start() {
    if (timer) return;
    // Allow short intervals for tests; enforce a minimal debounce of 100ms in production
    timer = setInterval(tick, Math.max(100, intervalMs));
    return { stop };
  }

  function stop() {
    stopped = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // start immediately
  start();
  return { stop };
}
