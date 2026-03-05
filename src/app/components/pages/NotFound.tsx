import { Link } from 'react-router';
import { ArrowLeft, Compass } from 'lucide-react';
import { Button } from '../ui/button';

export function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-6">
          <Compass className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-4xl font-bold mb-3">Page not found</h1>
        <p className="text-muted-foreground mb-8">
          The page you are looking for does not exist or may have been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/dashboard">
            <Button className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to dashboard
            </Button>
          </Link>
          <Link to="/">
            <Button variant="outline">Go home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
