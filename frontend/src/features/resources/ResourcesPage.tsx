import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAction, useApi } from '../../lib/hooks';
import {
  Avatar,
  MemberLink,
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
import { resourcePhotos } from './resourcePhotos';
import type { BorrowRequest, Page, Project, SharedResource } from '../../types';

const categories = {
  electronics: 'Electronics',
  tools: 'Tools',
  computing: 'Computing',
  materials: 'Materials',
  other: 'Other',
};
function ResourcePhoto({ title, detail = false }: { title: string; detail?: boolean }) {
  const [failed, setFailed] = useState(false);
  const photo = resourcePhotos[title];
  if (!photo)
    return (
      <span className="resource-photo-missing">No photo has been added for this resource.</span>
    );
  if (failed)
    return (
      <span className="resource-photo-missing" role="alert">
        The photo for {title} could not load.
      </span>
    );
  return (
    <figure className={`resource-photo${detail ? ' resource-photo-detail' : ''}`}>
      <img
        src={photo.src}
        alt={photo.alt}
        loading={detail ? 'eager' : 'lazy'}
        onError={() => setFailed(true)}
      />
      {detail && (
        <figcaption>
          <a href={photo.source} target="_blank" rel="noreferrer">
            {photo.author}
          </a>
          {' · '}
          <a href={photo.licenseUrl} target="_blank" rel="noreferrer">
            {photo.license}
          </a>
        </figcaption>
      )}
    </figure>
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
  const term = search.get('q') || '';
  const feed = search.get('feed') || 'for-you';
  const update = (values: Record<string, string>) => {
    const next = new URLSearchParams(search);
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    setSearch(next, { replace: true });
    setPage(1);
  };
  const [page, setPage] = useState(1);
  const resources = useApi<Page<SharedResource>>(
    `/resources/?page=${page}&category=${category}&q=${encodeURIComponent(term)}&feed=${tab === 'mine' ? 'all' : feed}${tab === 'mine' ? '&mine=1' : ''}`,
    tab !== 'requests',
  );
  const requests = useApi<Page<BorrowRequest>>(
    `/borrow-requests/?page=${page}`,
    tab === 'requests',
  );
  return (
    <>
      <PageHeader
        title="The sharing shelf"
        action={
          <Link className="button" to="/resources/new">
            Share a resource
          </Link>
        }
      />
      <div className="shelf-layout">
        <aside className="shelf-sidebar" aria-label="Resource navigation and filters">
          <nav aria-label="Resource sections">
            {[
              ['browse', 'Browse'],
              ['mine', 'My listings'],
              ['requests', 'Borrowing & lending'],
            ].map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? 'active' : ''}
                aria-current={tab === key ? 'page' : undefined}
                onClick={() => update({ tab: key })}
              >
                <span>{label}</span>
              </button>
            ))}
          </nav>
          {tab !== 'requests' && (
            <>
              <label className="shelf-search">
                <span>Search resources</span>
                <div>
                  <input
                    type="search"
                    value={term}
                    placeholder="Boards, tools, materials…"
                    onChange={(e) => update({ q: e.target.value })}
                  />
                </div>
              </label>
              {tab === 'browse' && (
                <div className="shelf-sort" aria-label="Resource order">
                  <button
                    className={feed === 'for-you' ? 'active' : ''}
                    aria-pressed={feed === 'for-you'}
                    onClick={() => update({ feed: 'for-you' })}
                  >
                    For you
                  </button>
                  <button
                    className={feed === 'all' ? 'active' : ''}
                    aria-pressed={feed === 'all'}
                    onClick={() => update({ feed: 'all' })}
                  >
                    Newest
                  </button>
                </div>
              )}
              <h2>Category</h2>
              <div className="shelf-categories">
                {[['', 'All resources'], ...Object.entries(categories)].map(([key, label]) => (
                  <button
                    key={key}
                    className={category === key ? 'active' : ''}
                    aria-pressed={category === key}
                    onClick={() => update({ category: key })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {(term || category) && (
                <button className="text-link" onClick={() => update({ q: '', category: '' })}>
                  Clear filters
                </button>
              )}
            </>
          )}
          {tab !== 'requests' && resources.data && (
            <p className="results-caption">{resources.data.count} resources</p>
          )}
        </aside>
        <div className="shelf-main">
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
                  <EmptyState title="No borrowing requests yet.">
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
              <div className="card-grid">
                {resources.data.results.map((resource) => (
                  <article className="resource-card" key={resource.id}>
                    <Link
                      to={`/resources/${resource.id}`}
                      className={`resource-art resource-${resource.category}`}
                      aria-label={`View ${resource.title}`}
                    >
                      <ResourcePhoto title={resource.title} />
                      <span className="resource-mode">
                        {resource.sharing === 'give' ? 'Free to keep' : 'Borrow & return'}
                      </span>
                    </Link>
                    <div className="card-content">
                      <h3>
                        <Link to={`/resources/${resource.id}`}>{resource.title}</Link>
                      </h3>
                      <p className="meta">{resource.location}</p>
                      {resource.status !== 'available' && (
                        <p className="meta">
                          {resource.status === 'given' ? 'Collected' : 'Listing paused'}
                        </p>
                      )}
                      <div className="card-bottom">
                        <span className="byline">
                          <MemberLink member={resource.owner} />
                        </span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {!resources.data.results.length && (
                <EmptyState
                  title={
                    term || category ? 'No resources match these filters.' : 'No resources yet.'
                  }
                >
                  <p>
                    {term || category
                      ? 'Try another search or clear your filters.'
                      : 'Have something a project could use?'}
                  </p>
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
        </div>
      </div>
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
        <span aria-hidden="true">←</span>
        The sharing shelf
      </Link>
      <div className="detail-layout">
        <article className="panel resource-detail">
          <ResourcePhoto key={resource.title} title={resource.title} detail />
          <h1>{resource.title}</h1>
          <p className="byline">
            <MemberLink member={resource.owner}>
              <Avatar name={resource.owner.display_name} />
            </MemberLink>
            Shared by{' '}
            <strong>
              <MemberLink member={resource.owner} />
            </strong>
          </p>
          <h2>Details</h2>
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
            <h2>
              {resource.is_owner
                ? 'Manage listing'
                : resource.sharing === 'give'
                  ? 'Request this item'
                  : 'Borrow this item'}
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
                <p className="small-success">Request {resource.my_request.status}</p>
                <Link className="button secondary" to="/resources?tab=requests">
                  View my request
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
        <span className="meta">{row.is_owner ? 'You’re sharing' : 'You’re requesting'}</span>
        <span className={`request-status status-${row.status}`}>{row.status}</span>
      </div>
      <h3>
        <Link to={`/resources/${row.resource.id}`}>{row.resource.title}</Link>
      </h3>
      <p className="byline">
        <MemberLink member={row.is_owner ? row.borrower : row.resource.owner}>
          <Avatar
            name={row.is_owner ? row.borrower.display_name : row.resource.owner.display_name}
          />
        </MemberLink>
        {row.is_owner ? 'For ' : 'From '}
        <MemberLink member={row.is_owner ? row.borrower : row.resource.owner} />
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
              Approve
            </button>
          </div>
        </>
      ) : row.is_owner && row.status === 'approved' ? (
        <>
          <p className="preserve-lines">{row.owner_note}</p>
          <ConfirmButton
            label={row.resource.sharing === 'loan' ? 'Mark returned' : 'Mark collected'}
            title={row.resource.sharing === 'loan' ? 'Mark as returned?' : 'Mark as collected?'}
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
        <span aria-hidden="true">←</span>
        The sharing shelf
      </Link>
      <PageHeader title={resource ? 'Edit listing' : 'Share a resource'} />
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
            {resource ? 'Save listing' : 'Create listing'}
          </BusyLabel>
        </button>
      </form>
    </div>
  );
}
