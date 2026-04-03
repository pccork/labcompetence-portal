interface ReportExportActionsProps {
  disabled: boolean;
  onDownloadCsv: () => void;
  onPrint: () => void;
}

export function ReportExportActions({
  disabled,
  onDownloadCsv,
  onPrint,
}: ReportExportActionsProps) {
  return (
    <div className="report-action-group buttons has-addons">
      <button
        className="button is-small is-light"
        disabled={disabled}
        onClick={onDownloadCsv}
        type="button"
      >
        Download CSV
      </button>
      <button
        className="button is-small is-light"
        disabled={disabled}
        onClick={onPrint}
        type="button"
      >
        Print / Save PDF
      </button>
    </div>
  );
}
