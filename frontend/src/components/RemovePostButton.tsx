import { useNavigate } from 'react-router-dom';
import { useAction } from '../lib/hooks';
import { ConfirmButton } from './ui';

const postTypes = {
  resource: {
    path: 'resources',
    label: 'Remove listing',
    destination: '/resources?tab=mine',
    details: 'the listing and its request history',
  },
  room: {
    path: 'rooms',
    label: 'Delete room',
    destination: '/rooms',
    details: 'the room, its messages, and its RSVPs',
  },
  project: {
    path: 'projects',
    label: 'Delete project',
    destination: '/projects',
    details: 'the project and its collaboration requests',
  },
};

export function RemovePostButton({
  kind,
  id,
  title,
}: {
  kind: keyof typeof postTypes;
  id: number;
  title: string;
}) {
  const action = useAction();
  const navigate = useNavigate();
  const post = postTypes[kind];
  return (
    <ConfirmButton
      label={post.label}
      title={`${post.label}?`}
      busy={action.isPending}
      onConfirm={async () => {
        await action.mutateAsync({ path: `/${post.path}/${id}/`, method: 'DELETE' });
        navigate(post.destination, { replace: true });
      }}
    >
      Permanently delete “{title}”? This removes {post.details} for everyone.
    </ConfirmButton>
  );
}
