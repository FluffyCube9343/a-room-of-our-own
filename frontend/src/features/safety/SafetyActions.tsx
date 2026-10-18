import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag, ShieldBan } from 'lucide-react';
import { useAction } from '../../lib/hooks';
import { BusyLabel, ConfirmButton, Dialog, ErrorNotice, Toast } from '../../components/ui';

export function SafetyActions({
  memberId,
  target = 'member',
  targetId,
  children,
}: {
  memberId: number;
  target?: 'member' | 'room' | 'project';
  targetId?: number;
  children?: ReactNode;
}) {
  const [report, setReport] = useState(false);
  const [message, setMessage] = useState('');
  const action = useAction();
  const navigate = useNavigate();
  return (
    <div className="safety-actions">
      {children}
      <button
        className="quiet-button"
        onClick={() => {
          action.reset();
          setReport(true);
        }}
      >
        <Flag size={14} />
        Report {target}
      </button>
      <ConfirmButton
        className="quiet-button"
        label={
          <>
            <ShieldBan size={14} />
            Block member
          </>
        }
        title="Make a little space?"
        busy={action.isPending}
        onConfirm={async () => {
          await action.mutateAsync({ path: `/blocks/${memberId}/`, method: 'PUT' });
          navigate('/profile#settings');
        }}
      >
        You won't see each other in discovery or be able to interact. Existing RSVPs and
        collaboration requests between you will be cancelled. You can unblock them in settings.
      </ConfirmButton>
      <Toast message={message} />
      {report && (
        <Dialog
          title="Help us care for this community."
          onClose={() => !action.isPending && setReport(false)}
        >
          <p>Your report is private and available to community moderators.</p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              const values = new FormData(event.currentTarget);
              try {
                await action.mutateAsync({
                  path: '/reports/',
                  body: {
                    [target]: targetId || memberId,
                    category: values.get('category'),
                    details: values.get('details'),
                  },
                });
                setReport(false);
                setMessage('Report received. Thank you for looking out for the community.');
              } catch {
                /* shown below */
              }
            }}
          >
            <label>
              What happened?
              <select name="category">
                <option value="harassment">Harassment</option>
                <option value="spam">Spam</option>
                <option value="inappropriate">Inappropriate content</option>
                <option value="other">Another concern</option>
              </select>
            </label>
            <label>
              Anything else we should know? <span className="optional">(optional)</span>
              <textarea name="details" maxLength={2000} rows={4} />
            </label>
            <ErrorNotice error={action.error} />
            <button className="button" disabled={action.isPending}>
              <BusyLabel busy={action.isPending}>Send report</BusyLabel>
            </button>
          </form>
        </Dialog>
      )}
    </div>
  );
}
