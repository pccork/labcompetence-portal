interface ReportExportActionsProps {
  disabled: boolean;
  onDownloadDocx: () => void;
}

export function ReportExportActions({
  disabled,
  onDownloadDocx,
}: ReportExportActionsProps) {
  return (
    <div className="report-action-group buttons">
      <button
        className="button is-small is-light"
        disabled={disabled}
        onClick={onDownloadDocx}
        type="button"
      >
        Download DOCX
      </button>
    </div>
  );
}
