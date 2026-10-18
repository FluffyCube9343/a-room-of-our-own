import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircuitBoard,
  Gift,
  Leaf,
  MapPin,
  Package,
  Plus,
  RotateCcw,
  Wrench,
} from 'lucide-react';
import { useAction, useApi } from '../../lib/hooks';
import {
  Avatar,
  BusyLabel,
  ConfirmButton,
  EmptyState,
  ErrorNotice,
  Loading,
  PageHeader,
  Pagination,
  Toast,
} from '../../components/ui';
import { SafetyActions } from '../safety/SafetyActions';
import type { BorrowRequest, Impact, Page, Project, SharedResource } from '../../types';

const categories = {
  electronics: 'Electronics',
  tools: 'Tools',
  computing: 'Computing',
  materials: 'Materials',
  other: 'Other',
};
function ResourceIcon({ category }: { category: string }) {
  return category === 'tools' ? (
    <Wrench size={34} strokeWidth={1.3} />
  ) : category === 'electronics' || category === 'computing' ? (
    <CircuitBoard size={38} strokeWidth={1.2} />
  ) : (
    <Package size={36} strokeWidth={1.3} />
  );
}
function DateRange({ start, end }: { start: string; end: string }) {
  const format = (value: string) =>
    new Date(value + 'T12:00:00').toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  return (
    <>
      {format(start)}
      {start !== end && ` – ${format(end)}`}
    </>
  );
}

export function ResourcesPage() {
  const [search, setSearch] = useSearchParams();
  const tab = search.get('tab') || 'browse';
  const category = search.get('category') || '';
  const [page, setPage] = useState(1);
  const resources = useApi<Page<SharedResource>>(
    `/resources/?page=${page}&category=${category}${tab === 'mine' ? '&mine=1' : ''}`,
    tab !== 'requests',
  );
  const requests = useApi<Page<BorrowRequest>>(
    `/borrow-requests/?page=${page}`,
    tab === 'requests',
  );
  const impact = useApi<Impact>('/impact/');
  return (
    <>
      <PageHeader
        eyebrow="LESS BUYING. MORE BUILDING."
        title="Good things deserve another project."
        description="Borrow a board. Share a tool. Give spare materials a second life."
        action={
          <Link className="button" to="/resources/new">
            <Plus size={17} />
            Share a resource
          </Link>
        }
      />
      <section className="resource-banner">
        <span className="resource-leaf">
          <Leaf size={37} strokeWidth={1.2} />
        </span>
        <div>
          <h2>
            A little less waste.
            <br />
            <em>A lot more possibility.</em>
          </h2>
          <p>Community gear for community ideas. Everything here is shared for free.</p>
        </div>
        <span className="resource-banner-note">
          USE IT.
          <br />
          PASS IT ON.
        </span>
      </section>
      {impact.data && (
        <section className="resource-banner" aria-label="Community impact">
          <span className="resource-leaf">
            <Leaf size={30} strokeWidth={1.2} />
          </span>
          <div>
            <h2>
              {impact.data.parts_shared} parts shared. {impact.data.parts_reused} reused.
            </h2>
            <p>
              {impact.data.active_loans} out on loan right now.
              {impact.data.live_rollup
                ? ' Live from our Tiger Data continuous aggregate, no separate analytics stack.'
                : ''}
            </p>
          </div>
        </section>
      )}
      <div className="browse-toolbar">
        <div className="tabs">
          {[
            ['browse', 'The sharing shelf'],
            ['mine', 'My listings'],
            ['requests', 'Borrowing & lending'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? 'active' : ''}
              onClick={() => {
                setSearch({ tab: key });
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {tab !== 'requests' && (
          <label className="filter-label">
            Category
            <select
              value={category}
              onChange={(e) => {
                setSearch({ tab, category: e.target.value });
                setPage(1);
              }}
            >
              <option value="">All resources</option>
              {Object.entries(categories).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {tab === 'requests' ? (
        requests.isPending ? (
          <Loading />
        ) : requests.isError ? (
          <ErrorNotice error={requests.error} retry={() => void requests.refetch()} />
        ) : (
          <>
            <div className="borrow-grid">
              {requests.data.results.map((row) => (
                <BorrowCard key={row.id} row={row} />
              ))}
            </div>
            {!requests.data.results.length && (
              <EmptyState title="Your next project might need a little something.">
                Requests you send and receive will appear here.
              </EmptyState>
            )}
            {requests.data.count > 24 && (
              <Pagination page={page} next={requests.data.next} onChange={setPage} />
            )}
          </>
        )
      ) : resources.isPending ? (
        <Loading />
      ) : resources.isError ? (
        <ErrorNotice error={resources.error} retry={() => void resources.refetch()} />
      ) : (
        <>
          <p className="results-caption">
            {resources.data.count} resources{' '}
            {tab === 'mine' ? 'you’re sharing' : 'with more to give'}
          </p>
          <div className="card-grid">
            {resources.data.results.map((resource) => (
              <article className="resource-card" key={resource.id}>
                <Link
                  to={`/resources/${resource.id}`}
                  className={`resource-art resource-${resource.category}`}
                  aria-label={`View ${resource.title}`}
                >
                  <ResourceIcon category={resource.category} />
                  <span className="resource-mode">
                    {resource.sharing === 'give' ? <Gift size={13} /> : <RotateCcw size={13} />}{' '}
                    {resource.sharing === 'give' ? 'Free to keep' : 'Borrow & return'}
                  </span>
                </Link>
                <div className="card-content">
                  <span className="tiny-label">
                    {categories[resource.category as keyof typeof categories]} · {resource.status}
                  </span>
                  <h3>
                    <Link to={`/resources/${resource.id}`}>{resource.title}</Link>
                  </h3>
                  <p className="clamp-two">{resource.description}</p>
                  <p className="meta">
                    <MapPin size={13} />
                    {resource.location}
                  </p>
                  <div className="card-bottom">
                    <span className="byline">
                      <Avatar name={resource.owner.display_name} />
                      {resource.owner.display_name}
                    </span>
                    <Link
                      className="circle-link"
                      to={`/resources/${resource.id}`}
                      aria-label={`Explore ${resource.title}`}
                    >
                      <ArrowUpRight size={18} />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {!resources.data.results.length && (
            <EmptyState title="A little room on the shelf.">
              <p>Have something a project could use?</p>
              <Link className="button secondary" to="/resources/new">
                Share a resource
              </Link>
            </EmptyState>
          )}
          {resources.data.count > 24 && (
            <Pagination page={page} next={resources.data.next} onChange={setPage} />
          )}
        </>
      )}
    </>
  );
}
export function ResourceDetail() {
  const { id } = useParams();
  const query = useApi<SharedResource>(`/resources/${id}/`);
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  return <ResourceContent resource={query.data} />;
}
function ResourceContent({ resource }: { resource: SharedResource }) {
  const projects = useApi<Page<Project>>('/projects/?mine=1');
  const action = useAction();
  const [message, setMessage] = useState('');
  const [start, setStart] = useState('');
  return (
    <>
      <Link className="back-link" to="/resources">
        <ArrowLeft size={16} />
        The sharing shelf
      </Link>
      <div className="detail-layout">
        <article className="panel resource-detail">
          <div className={`resource-detail-icon resource-${resource.category}`}>
            <ResourceIcon category={resource.category} />
          </div>
          <span className="eyebrow">
            {resource.sharing === 'give'
              ? 'A SECOND LIFE, FREE TO KEEP'
              : 'BORROW IT. BUILD WITH IT. BRING IT BACK.'}
          </span>
          <h1>{resource.title}</h1>
          <p className="byline">
            <Avatar name={resource.owner.display_name} />
            Shared by <strong>{resource.owner.display_name}</strong>
          </p>
          <h2>A little about it</h2>
          <p className="preserve-lines">{resource.description}</p>
          <dl className="resource-facts">
            <div>
              <dt>Condition</dt>
              <dd>{resource.condition}</dd>
            </div>
            <div>
              <dt>Pickup area</dt>
              <dd>{resource.location}</dd>
            </div>
            <div>
              <dt>Sharing</dt>
              <dd>{resource.sharing === 'give' ? 'Free to keep' : 'Free to borrow'}</dd>
            </div>
          </dl>
          {resource.reservations.length > 0 && (
            <section className="reservation-note">
              <h3>Already reserved</h3>
              {resource.reservations.map((range, index) => (
                <p key={index}>
                  <DateRange start={range.start_date} end={range.end_date} />
                </p>
              ))}
              <small>
                {resource.sharing === 'give'
                  ? 'An approved handoff is in progress.'
                  : 'Choose dates outside these reservations.'}
              </small>
            </section>
          )}
          {!resource.is_owner && <SafetyActions memberId={resource.owner.id} />}
        </article>
        <aside>
          <section className="panel booking-panel">
            <Leaf size={23} strokeWidth={1.5} />
            <h2>
              {resource.is_owner
                ? 'A little care for your gear.'
                : resource.sharing === 'give'
                  ? 'Give it a new purpose.'
                  : 'Build more. Buy less.'}
            </h2>
            {resource.is_owner ? (
              <div className="stack">
                <Link className="button" to={`/resources/${resource.id}/edit`}>
                  Edit listing
                </Link>
                <Link className="button secondary" to="/resources?tab=requests">
                  Manage requests
                </Link>
              </div>
            ) : resource.my_request ? (
              <>
                <p className="small-success">
                  <Check size={16} />
                  Request {resource.my_request.status}
                </p>
                <Link className="button secondary" to="/resources?tab=requests">
                  View my request <ArrowRight size={15} />
                </Link>
              </>
            ) : resource.status !== 'available' ? (
              <p>
                This item is{' '}
                {resource.status === 'given'
                  ? 'already with its next maker'
                  : 'taking a break from the shelf'}
                .
              </p>
            ) : (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  const data = new FormData(event.currentTarget);
                  try {
                    await action.mutateAsync({
                      path: `/resources/${resource.id}/requests/`,
                      body: {
                        start_date: data.get('start_date'),
                        end_date:
                          resource.sharing === 'give'
                            ? data.get('start_date')
                            : data.get('end_date'),
                        project: data.get('project') ? Number(data.get('project')) : null,
                        note: data.get('note'),
                      },
                    });
                    setMessage('Request sent. The owner can approve it and share pickup details.');
                  } catch {
                    /*shown*/
                  }
                }}
              >
                <label>
                  {resource.sharing === 'give' ? 'Preferred pickup date' : 'Borrow from'}
                  <input
                    type="date"
                    name="start_date"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    required
                  />
                </label>
                {resource.sharing === 'loan' && (
                  <label>
                    Return by
                    <input type="date" name="end_date" min={start} required />
                  </label>
                )}
                <label>
                  For a project <span className="optional">(optional)</span>
                  <select name="project">
                    <option value="">Just exploring</option>
                    {projects.data?.results.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  A note to the owner
                  <textarea
                    name="note"
                    rows={3}
                    maxLength={1000}
                    placeholder="What are you working on? When could you pick it up?"
                  />
                </label>
                <button className="button full" disabled={action.isPending}>
                  <BusyLabel busy={action.isPending}>
                    {resource.sharing === 'give' ? 'Request this item' : 'Request to borrow'}
                    <ArrowRight size={16} />
                  </BusyLabel>
                </button>
                <p className="form-footnote">
                  A request isn't a reservation until the owner approves it. Coordinate exact pickup
                  details privately.
                </p>
              </form>
            )}
            <ErrorNotice error={action.error} />
            <Toast message={message} />
          </section>
        </aside>
      </div>
    </>
  );
}
function BorrowCard({ row }: { row: BorrowRequest }) {
  const action = useAction();
  const [note, setNote] = useState(row.owner_note);
  const run = (value: string) =>
    action.mutateAsync({
      path: `/borrow-requests/${row.id}/`,
      method: 'PATCH',
      body: { action: value, owner_note: note },
    });
  return (
    <article className="panel borrow-card">
      <div className="section-heading">
        <span className="eyebrow">{row.is_owner ? 'YOU’RE SHARING' : 'YOU’RE REQUESTING'}</span>
        <span className={`request-status status-${row.status}`}>{row.status}</span>
      </div>
      <h3>
        <Link to={`/resources/${row.resource.id}`}>{row.resource.title}</Link>
      </h3>
      <p className="byline">
        <Avatar name={row.is_owner ? row.borrower.display_name : row.resource.owner.display_name} />
        {row.is_owner
          ? `For ${row.borrower.display_name}`
          : `From ${row.resource.owner.display_name}`}
      </p>
      <p className="request-dates">
        <DateRange start={row.start_date} end={row.end_date} />
      </p>
      {row.project_title && <p className="meta">Project: {row.project_title}</p>}
      {row.note && <blockquote>{row.note}</blockquote>}
      {row.is_owner && row.status === 'pending' ? (
        <>
          <label>
            Private pickup details / reply <span className="optional">(optional)</span>
            <textarea
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Shared only with this requester."
            />
          </label>
          <div className="button-row">
            <button
              className="button secondary"
              disabled={action.isPending}
              onClick={() => void run('decline').catch(() => {})}
            >
              Decline
            </button>
            <button
              className="button"
              disabled={action.isPending}
              onClick={() => void run('approve').catch(() => {})}
            >
              <Check size={16} />
              Approve
            </button>
          </div>
        </>
      ) : row.is_owner && row.status === 'approved' ? (
        <>
          <p className="preserve-lines">{row.owner_note}</p>
          <ConfirmButton
            label={row.resource.sharing === 'loan' ? 'Mark returned' : 'Mark collected'}
            title={row.resource.sharing === 'loan' ? 'Back on the shelf?' : 'Off to a new home?'}
            busy={action.isPending}
            onConfirm={() => run(row.resource.sharing === 'loan' ? 'return' : 'collect')}
          >
            {row.resource.sharing === 'loan'
              ? 'Confirm the item has been returned to you.'
              : 'Confirm the item has been collected. This closes the listing and other pending requests.'}
          </ConfirmButton>
        </>
      ) : (
        <>
          {row.owner_note && (
            <div className="owner-reply">
              <strong>From the owner</strong>
              <p>{row.owner_note}</p>
            </div>
          )}
          {!row.is_owner && row.status === 'pending' && (
            <ConfirmButton
              label="Cancel request"
              title="Cancel this request?"
              busy={action.isPending}
              onConfirm={() => run('cancel')}
            >
              The owner will no longer be asked to approve this request.
            </ConfirmButton>
          )}
          {row.status === 'approved' && !row.is_owner && (
            <p className="small-success">
              {row.resource.sharing === 'loan'
                ? 'Approved. The owner will mark it returned after you bring it back.'
                : 'Approved. Arrange pickup using the owner’s details above.'}
            </p>
          )}
        </>
      )}
      <ErrorNotice error={action.error} />
    </article>
  );
}
export function ResourceEditor() {
  const { id } = useParams();
  const query = useApi<SharedResource>(`/resources/${id}/`, !!id);
  if (id && query.isPending) return <Loading />;
  if (id && query.isError)
    return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  if (id && !query.data?.is_owner)
    return <EmptyState title="Only the owner can edit this listing." />;
  return <ResourceForm key={id || 'new'} resource={query.data} />;
}
function ResourceForm({ resource }: { resource?: SharedResource }) {
  const action = useAction<SharedResource>();
  const navigate = useNavigate();
  return (
    <div className="form-page">
      <Link className="back-link" to="/resources">
        <ArrowLeft size={16} />
        The sharing shelf
      </Link>
      <PageHeader
        eyebrow="LET GOOD THINGS KEEP GOING"
        title={resource ? 'A little care for your listing.' : 'What could someone build with it?'}
        description="Share hardware, tools, and leftover materials with the community."
      />
      <form
        className="panel"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          try {
            const result = await action.mutateAsync({
              path: resource ? `/resources/${resource.id}/` : '/resources/',
              method: resource ? 'PATCH' : 'POST',
              body: Object.fromEntries(data),
            });
            navigate(`/resources/${result.id}`);
          } catch {
            /*shown*/
          }
        }}
      >
        <label>
          Item name
          <input
            name="title"
            defaultValue={resource?.title}
            maxLength={140}
            required
            placeholder="e.g. Arduino starter kit"
          />
        </label>
        <label>
          What’s included?
          <textarea
            name="description"
            defaultValue={resource?.description}
            maxLength={3000}
            rows={4}
            required
            placeholder="Parts, useful details, and anything a borrower should know."
          />
        </label>
        <div className="form-two">
          <label>
            Category
            <select name="category" defaultValue={resource?.category || 'electronics'}>
              {Object.entries(categories).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            How would you like to share?
            <select name="sharing" defaultValue={resource?.sharing || 'loan'}>
              <option value="loan">Borrow & return</option>
              <option value="give">Free to keep</option>
            </select>
          </label>
        </div>
        <label>
          Condition
          <input
            name="condition"
            defaultValue={resource?.condition}
            maxLength={80}
            required
            placeholder="e.g. Good, all parts tested"
          />
        </label>
        <label>
          General pickup area
          <input
            name="location"
            defaultValue={resource?.location}
            maxLength={120}
            required
            placeholder="e.g. Engineering quad"
          />
          <small>
            Keep exact addresses and contact details for your private reply to a request.
          </small>
        </label>
        {resource && resource.status !== 'given' && (
          <label>
            Listing visibility
            <select name="status" defaultValue={resource.status}>
              <option value="available">Available on the shelf</option>
              <option value="paused">Paused</option>
            </select>
          </label>
        )}
        <ErrorNotice error={action.error} />
        <button className="button full" disabled={action.isPending || resource?.status === 'given'}>
          <BusyLabel busy={action.isPending}>
            {resource ? 'Save listing' : 'Put it on the shelf'}
            <Leaf size={16} />
          </BusyLabel>
        </button>
      </form>
    </div>
  );
}
