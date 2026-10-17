import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Plus, Sparkles } from 'lucide-react';
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
  ProjectCard,
  TagPicker,
  Tags,
  Toast,
} from '../../components/ui';
import { SafetyActions } from '../safety/SafetyActions';
import type { Interest, Page, Project } from '../../types';

export function ProjectsPage() {
  const [search, setSearch] = useSearchParams();
  const [page, setPage] = useState(1);
  const mine = search.get('mine') === '1';
  const query = useApi<Page<Project>>(`/projects/?page=${page}${mine ? '&mine=1' : ''}`);
  return (
    <>
      <PageHeader
        eyebrow="GOOD IDEAS DESERVE GOOD COMPANY"
        title="Let's build something together."
        description="That idea you've been sitting on? There's someone here who wants to help."
        action={
          <Link className="button" to="/projects/new">
            <Plus size={17} />
            Share an idea
          </Link>
        }
      />
      <div className="project-intro">
        <Sparkles size={24} strokeWidth={1.4} />
        <p>
          You don't need a finished plan.{' '}
          <strong>Just a little curiosity and a place to start.</strong>
        </p>
      </div>
      <div className="browse-toolbar">
        <div className="tabs">
          <button
            className={!mine ? 'active' : ''}
            onClick={() => {
              setSearch({});
              setPage(1);
            }}
          >
            Find your next project
          </button>
          <button
            className={mine ? 'active' : ''}
            onClick={() => {
              setSearch({ mine: '1' });
              setPage(1);
            }}
          >
            My ideas
          </button>
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <p className="results-caption">{query.data.count} ideas with room to grow</p>
          <div className="card-grid">
            {query.data.results.map((project) => (
              <ProjectCard project={project} key={project.id} />
            ))}
          </div>
          {!query.data.results.length && (
            <EmptyState title="Your idea could start something.">
              <Link className="button" to="/projects/new">
                Share an idea <Plus size={16} />
              </Link>
            </EmptyState>
          )}
          {query.data.count > 24 && (
            <Pagination page={page} next={query.data.next} onChange={setPage} />
          )}
        </>
      )}
    </>
  );
}
export function ProjectDetail() {
  const { id } = useParams();
  const query = useApi<Project>(`/projects/${id}/`);
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  return <ProjectContent project={query.data} />;
}
function ProjectContent({ project }: { project: Project }) {
  const action = useAction();
  const [message, setMessage] = useState('');
  const [intro, setIntro] = useState('');
  return (
    <>
      <Link className="back-link" to="/projects">
        <ArrowLeft size={16} />
        All projects
      </Link>
      <div className="detail-layout">
        <article className="panel project-detail">
          <div className="project-detail-emblem">
            <Sparkles size={38} strokeWidth={1.2} />
          </div>
          <p className="eyebrow">
            {project.status === 'open'
              ? 'AN IDEA WITH ROOM TO GROW'
              : 'CLOSED TO NEW COLLABORATORS'}
          </p>
          <h1>{project.title}</h1>
          <Tags ids={project.tags} />
          <p className="byline">
            <Avatar name={project.owner.display_name} />
            <span>
              An idea from <strong>{project.owner.display_name}</strong>
              <span className="meta block">{project.owner.role}</span>
            </span>
          </p>
          <h2>The idea</h2>
          <p className="preserve-lines">{project.description}</p>
          <h2>A little help with…</h2>
          <Tags ids={project.needed_skills} />
          {project.repository_url && (
            <a className="text-link" href={project.repository_url} target="_blank" rel="noreferrer">
              Explore the repository <ArrowUpRight size={17} />
            </a>
          )}
          {!project.is_owner && (
            <SafetyActions memberId={project.owner.id} target="project" targetId={project.id} />
          )}
        </article>
        <aside>
          <section className="panel booking-panel">
            <span className="eyebrow">BETTER, TOGETHER</span>
            <h2>{project.is_owner ? 'Your idea, taking shape.' : 'Bring your curiosity.'}</h2>
            <p>
              {project.is_owner
                ? 'Keep your idea up to date and see who wants to build with you.'
                : "You don't have to know everything. A little interest is a great place to start."}
            </p>
            {project.is_owner ? (
              <div className="stack">
                <Link className="button" to={`/projects/${project.id}/edit`}>
                  Edit project
                </Link>
                <ConfirmButton
                  label={project.status === 'open' ? 'Close to new requests' : 'Reopen project'}
                  title={project.status === 'open' ? 'Close your project?' : 'Open the door again?'}
                  busy={action.isPending}
                  onConfirm={() =>
                    action.mutateAsync({
                      path: `/projects/${project.id}/`,
                      method: 'PATCH',
                      body: { status: project.status === 'open' ? 'closed' : 'open' },
                    })
                  }
                >
                  {project.status === 'open'
                    ? 'Existing requests stay visible to you. New collaborators will no longer be able to request to join.'
                    : 'Your project will appear in discovery and accept new requests.'}
                </ConfirmButton>
              </div>
            ) : project.interest_status === 'pending' ? (
              <>
                <p className="small-success">
                  <Check size={17} />
                  Your request is with {project.owner.display_name.split(' ')[0]}.
                </p>
                <p className="small-copy">
                  The owner can read your introduction. Team acceptance and messaging are coming
                  later.
                </p>
                <ConfirmButton
                  label="Withdraw request"
                  title="Withdraw your introduction?"
                  busy={action.isPending}
                  onConfirm={async () => {
                    await action.mutateAsync({
                      path: `/projects/${project.id}/interest/`,
                      method: 'DELETE',
                    });
                    setMessage('Your request has been withdrawn.');
                  }}
                >
                  You can send another request while this project is open.
                </ConfirmButton>
              </>
            ) : (
              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  try {
                    await action.mutateAsync({
                      path: `/projects/${project.id}/interest/`,
                      method: 'PUT',
                      body: { introduction: intro },
                    });
                    setMessage('Request sent. A good first step.');
                  } catch {
                    /* below */
                  }
                }}
              >
                <label>
                  A little introduction <span className="optional">(optional)</span>
                  <textarea
                    value={intro}
                    onChange={(event) => setIntro(event.target.value)}
                    rows={4}
                    maxLength={1000}
                    placeholder="What excites you about this idea?"
                  />
                </label>
                <button
                  className="button full"
                  disabled={action.isPending || project.status === 'closed'}
                >
                  <BusyLabel busy={action.isPending}>
                    {project.status === 'closed' ? 'Project closed' : 'Request to join'}
                    <ArrowRight size={17} />
                  </BusyLabel>
                </button>
              </form>
            )}
            <ErrorNotice error={action.error} />
            <Toast message={message} />
          </section>
          {project.is_owner && <Requests projectId={project.id} />}
        </aside>
      </div>
    </>
  );
}
function Requests({ projectId }: { projectId: number }) {
  const [page, setPage] = useState(1);
  const query = useApi<Page<Interest>>(`/projects/${projectId}/interests/?page=${page}`);
  return (
    <section className="panel">
      <h3>People who want to help</h3>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          {!query.data.results.length && (
            <p>Your next collaborator could be just around the corner.</p>
          )}
          {query.data.results.map((row) => (
            <div className="request-row" key={row.requester.id}>
              <p className="byline">
                <Avatar name={row.requester.display_name} />
                <strong>{row.requester.display_name}</strong>
              </p>
              <p className="preserve-lines">
                {row.introduction || 'Interested in building with you.'}
              </p>
            </div>
          ))}
          {query.data.count > 24 && (
            <Pagination page={page} next={query.data.next} onChange={setPage} />
          )}
        </>
      )}
    </section>
  );
}
const schema = z.object({
  title: z.string().trim().min(3, 'Give your idea a name.').max(140),
  description: z.string().trim().min(10, 'Tell us a little more about your idea.').max(4000),
  tags: z.array(z.number()).min(1, 'Choose at least one topic.'),
  needed_skills: z.array(z.number()).min(1, 'Choose a skill you need.'),
  repository_url: z.union([
    z.literal(''),
    z.url('Enter a valid URL.').startsWith('https://', 'Use an https:// link.'),
  ]),
});
type Values = z.infer<typeof schema>;
export function ProjectEditor() {
  const { id } = useParams();
  const query = useApi<Project>(`/projects/${id}/`, !!id);
  if (id && query.isPending) return <Loading />;
  if (id && query.isError)
    return <ErrorNotice error={query.error} retry={() => void query.refetch()} />;
  if (id && !query.data?.is_owner)
    return <EmptyState title="Only the owner can edit this project." />;
  return <ProjectForm key={id || 'new'} project={query.data} />;
}
function ProjectForm({ project }: { project?: Project }) {
  const action = useAction<Project>();
  const navigate = useNavigate();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: project?.title || '',
      description: project?.description || '',
      tags: project?.tags || [],
      needed_skills: project?.needed_skills || [],
      repository_url: project?.repository_url || '',
    },
  });
  const errors = form.formState.errors;
  return (
    <div className="form-page">
      <Link className="back-link" to={project ? `/projects/${project.id}` : '/projects'}>
        <ArrowLeft size={16} />
        Back to projects
      </Link>
      <PageHeader
        eyebrow="EVERY GOOD THING STARTS SOMEWHERE"
        title={project ? 'Give your idea a little care.' : 'Put your idea out there.'}
        description="It doesn't need to be perfect. It just needs to be yours."
      />
      <form
        className="panel"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            const result = await action.mutateAsync({
              path: project ? `/projects/${project.id}/` : '/projects/',
              method: project ? 'PATCH' : 'POST',
              body: values,
            });
            navigate(`/projects/${result.id}`);
          } catch {
            /* below */
          }
        })}
      >
        <label>
          What's your idea called?
          <input
            {...form.register('title')}
            placeholder="e.g. A more accessible campus"
            maxLength={140}
          />
          <small className="field-error">{errors.title?.message}</small>
        </label>
        <label>
          Tell us about it
          <textarea
            {...form.register('description')}
            rows={6}
            maxLength={4000}
            placeholder="What do you want to build? Why does it matter to you?"
          />
          <small className="field-error">{errors.description?.message}</small>
        </label>
        <Controller
          name="tags"
          control={form.control}
          render={({ field }) => (
            <TagPicker
              label="What brings this idea to life?"
              value={field.value}
              onChange={field.onChange}
              error={errors.tags?.message}
            />
          )}
        />
        <Controller
          name="needed_skills"
          control={form.control}
          render={({ field }) => (
            <TagPicker
              label="I'd love a little help with…"
              value={field.value}
              onChange={field.onChange}
              error={errors.needed_skills?.message}
            />
          )}
        />
        <label>
          Repository link <span className="optional">(optional)</span>
          <input
            type="url"
            {...form.register('repository_url')}
            placeholder="https://github.com/…"
          />
          <small className="field-error">{errors.repository_url?.message}</small>
        </label>
        <ErrorNotice error={action.error} />
        <button className="button full" disabled={action.isPending}>
          <BusyLabel busy={action.isPending}>
            {project ? 'Save changes' : 'Share my idea'}
            <ArrowUpRight size={17} />
          </BusyLabel>
        </button>
      </form>
    </div>
  );
}
