import * as api from '../lib/bridge/mail';
import { useTranslation } from '../lib/i18n/useTranslation';
import type { MailController } from './useMail';
import styles from './MailContent.module.css';
import { mailAccountNotice, MailAccountNotice } from './MailAccountNotice';

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
              event.currentTarget.closest('section')?.focus();
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
      ) : mail.hasMore && !mail.filter ? (
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
  const { t } = useTranslation('mail');
  const notice = mailAccountNotice(mail);
  const items = mail.messages.filter((message) =>
    `${message.subject} ${message.from}`
      .toLocaleLowerCase()
      .includes(mail.filter.toLocaleLowerCase()),
  );
  return (
    <section
      key={mail.listKey}
      className={styles.list}
      aria-label={t('messageList')}
      aria-busy={mail.listLoading}
      tabIndex={0}
      onScroll={(event) => {
        const viewport = event.currentTarget;
        if (
          mail.hasMore &&
          !mail.listLoading &&
          mail.listError == null &&
          viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= LOAD_AHEAD_PX
        ) {
          mail.loadMore();
        }
      }}
    >
      <MailAccountNotice mail={mail} notice={notice} />
      {items.length === 0 &&
        !mail.listLoading &&
        mail.listError == null &&
        (!notice || mail.messages.length > 0) && (
          <p className={styles.empty}>
            {t(mail.messages.length > 0 ? 'noMatchingMessages' : 'noMessages')}
          </p>
        )}
      <ul>
        {items.map((message) => (
          <li key={message.id}>
            <button
              type="button"
              aria-pressed={mail.selected === message.id}
              onClick={() => mail.setSelected(message.id)}
            >
              <span className={styles.sender}>{message.from}</span>
              <time>{formatTime(message.receivedAt)}</time>
              <strong className={message.read ? styles.read : undefined}>
                {message.subject || t('noSubject')}
              </strong>
            </button>
          </li>
        ))}
      </ul>
      <ListStatus mail={mail} />
    </section>
  );
}
