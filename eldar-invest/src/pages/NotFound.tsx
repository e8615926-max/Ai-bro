import { Compass } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/misc';

export default function NotFound() {
  return (
    <Card>
      <EmptyState icon={<Compass />} title="Page not found" body="The page you're looking for doesn't exist or has moved." action={<ButtonLink to="/">Back to home</ButtonLink>} />
    </Card>
  );
}
