import * as api from '../lib/bridge/mail';
import { useTranslation } from '../lib/i18n/useTranslation';
import type { MailController } from './useMail';
import styles from './MailList.module.css';
import { UiIcon } from '../components/UiIcon/UiIcon';
import { ScrollArea } from '../components/ScrollArea/ScrollArea';
import { mailAccountNotice, MailAccountNotice, mailSyncState } from './MailAccountNotice';
import { MailListSkeleton } from './MailListSkeleton';
import { useMailListTransition } from './useMailListTransition';

// 约提前两个邮件行加载，读取仍受控制器的串行、错误和结束状态约束。
const LOAD_AHEAD_PX = 160;

function ListStatus({ mail }: { mail: MailController }) {
  const { t } = useTranslation('mail');
  return (
    <footer className={styles['list-status']}>
      {mail.listError != null ? (
        <>
          <p role="alert" className={styles.error}>
            {t(api.errorKey(mail.listError))}
          </p>
          <button
            type="button"
            onClick={(event) => {
              event.currentTarget.closest<HTMLElement>('[role="region"]')?.focus();
              mail.retryList();
            }}
          >
            {t('retryList')}
          </button>
        </>
      ) : mail.listLoading ? (
        <p role="status">{t('loading')}</p>
      ) : mail.listLimitReached ? (
        <p role="status">{t('listLimitReached')}</p>
      ) : mail.messages.length > 0 && !mail.hasMore ? (
        <p role="status">{t('allMessagesLoaded')}</p>
      ) : mail.hasMore &&
        (mail.filter || mail.viewOptions?.unreadOnly || mail.viewOptions?.attachmentsOnly) ? (
        <button type="button" onClick={mail.loadMore}>
          {t('loadMoreMessages')}
        </button>
      ) : mail.hasMore ? (
        <p>{t('scrollForMore')}</p>
      ) : null}
    </footer>
  );
}

export function MailList({
  mail,
  formatTime,
}: {
  mail: MailController;
  formatTime: (time: number) => string;
}) {
  return <ScopedMailList key={mail.listKey} mail={mail} formatTime={formatTime} />;
}

function ScopedMailList({
  mail,
  formatTime,
}: {
  mail: MailController;
  formatTime: (time: number) => string;
}) {
  const { t, locale } = useTranslation('mail');
  const { waiting, listRef } = useMailListTransition(mail);
  const notice = mailAccountNotice(mail);
  const syncing = ['running', 'partial'].includes(mailSyncState(mail));
  const currentYear = new Date().getFullYear();
  const shortDate = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
  const datedYear = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const clock = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const items = waiting ? [] : mail.visibleMessages;
  return (
    <ScrollArea
      key={mail.listKey}
      className={styles.list}
      viewportClassName={styles.viewport}
      edgeFade
      role="region"
      aria-label={t('messageList')}
      aria-busy={mail.listLoading || waiting}
      tabIndex={0}
      onScroll={(event) => {
        const viewport = event.currentTarget;
        if (
          !waiting &&
          mail.hasMore &&
          !mail.listLoading &&
          mail.listError == null &&
          viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= LOAD_AHEAD_PX
        ) {
          mail.loadMore();
        }
      }}
    >
      {waiting && <MailListSkeleton />}
      {!waiting && <MailAccountNotice mail={mail} notice={notice} />}
      {!waiting && mail.actionError != null && (
        <p role="alert" className={styles.error}>
          {t(api.errorKey(mail.actionError))}
        </p>
      )}
      {!waiting && mail.viewOptions?.attachmentsOnly && (
        <p className={styles.empty}>{t('attachmentFilterHint')}</p>
      )}
      {!waiting && mail.starError != null && (
        <p role="alert" className={styles.error}>
          {t('starFailed')} {t(api.errorKey(mail.starError))}
        </p>
      )}
      {!waiting &&
        items.length === 0 &&
        !mail.listLoading &&
        !syncing &&
        mail.listError == null &&
        (!notice || mail.messages.length > 0) && (
          <p className={styles.empty}>
            {t(mail.messages.length > 0 ? 'noMatchingMessages' : 'noMessages')}
          </p>
        )}
      <ul ref={listRef} hidden={waiting}>
        {items.map((message) => {
          const sender = message.from.trim() || t('unknownSender');
          const subject = message.subject.trim() || t('noSubject');
          const initial = message.from.match(/[\p{L}\p{N}]/u)?.[0].toLocaleUpperCase(locale);
          const date = new Date(message.receivedAt);
          const validDate = Number.isFinite(date.getTime());
          const fullTime = validDate ? formatTime(message.receivedAt) : '—';
          const label = `${sender}\n${subject}\n${fullTime} · ${t(message.read ? 'readMessage' : 'unreadMessage')}${message.bodyErrorCode ? ` · ${t('mailboxLimited')}` : ''}`;
          // 全局提示最多接收 1024 字符；完整内容仍保留在无障碍名称及阅读区。
          const tooltip = label.length > 1024 ? `${label.slice(0, 1023)}…` : label;
          return (
            <li key={message.id} className={styles['message-row']} data-mail-reveal>
              <button
                className={styles.item}
                type="button"
                aria-pressed={mail.selected === message.id}
                aria-label={label}
                data-tooltip={tooltip}
                data-read={message.read}
                onClick={() => mail.setSelected(message.id)}
              >
                <span className={styles['item-header']}>
                  <span className={styles.avatar} aria-hidden="true">
                    {initial || '?'}
                  </span>
                  <span className={styles.identity}>
                    <span className={styles.sender}>{sender}</span>
                    {message.bodyErrorCode && (
                      <span
                        className={styles.limited}
                        role="img"
                        aria-label={t('mailboxLimited')}
                        data-tooltip={t(api.errorKey(message.bodyErrorCode))}
                      >
                        <UiIcon name="about" size={13} />
                      </span>
                    )}
                    {!message.read && <span className={styles.unread} aria-hidden="true" />}
                  </span>
                  <time dateTime={validDate ? date.toISOString() : undefined}>
                    {validDate ? (
                      <>
                        <span>
                          {(date.getFullYear() === currentYear ? shortDate : datedYear).format(
                            date,
                          )}
                        </span>
                        <span>{clock.format(date)}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </time>
                </span>
                <strong className={styles.subject}>{subject}</strong>
              </button>
              <button
                type="button"
                className={styles['star-button']}
                aria-label={t(message.starred ? 'unstarMessage' : 'starMessage', { subject })}
                data-tooltip={t(
                  mail.isStarPending(message.id)
                    ? 'starSaving'
                    : message.starred
                      ? 'unstarAction'
                      : 'starAction',
                )}
                aria-pressed={message.starred}
                aria-busy={mail.isStarPending(message.id)}
                disabled={mail.isStarPending(message.id)}
                onClick={() => void mail.toggleStarred(message)}
              >
                <UiIcon name="starred" size={16} selected={message.starred} />
              </button>
            </li>
          );
        })}
      </ul>
      {!waiting && <ListStatus mail={mail} />}
    </ScrollArea>
  );
}
