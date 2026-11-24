import { useI18n } from "../../i18n";
import {
  AsyncActionButton,
  type AsyncActionStatus,
} from "../common/AsyncActionButton";
import { Icon } from "../common/Icon";

export function DataDirMigrateFooter({
  done,
  status,
  busyOrDone,
  checkValid,
  onBack,
  onRestart,
  onMigrate,
}: {
  done: boolean;
  status: AsyncActionStatus;
  busyOrDone: boolean;
  checkValid: boolean;
  onBack: () => void;
  onRestart: () => void;
  onMigrate: () => void;
}) {
  const { t } = useI18n();
  if (done) {
    return (
      <>
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          {t("overlays.migrateRestartLaterBtn")}
        </button>
        <button type="button" className="btn btn-primary" onClick={onRestart}>
          <Icon name="refresh" size={14} /> {t("overlays.migrateRestartNowBtn")}
        </button>
      </>
    );
  }
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busyOrDone}
        onClick={onBack}
      >
        {t("common.cancel")}
      </button>
      <AsyncActionButton
        status={status}
        disabled={!checkValid}
        idleIcon="database"
        idleLabel={t("overlays.migrateStartIdle")}
        loadingLabel={t("overlays.migrateStartLoading")}
        successLabel={t("overlays.migrateStartSuccess")}
        errorLabel={t("overlays.migrateStartError")}
        onClick={onMigrate}
      />
    </>
  );
}
