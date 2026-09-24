import { Route, Router, Switch } from "wouter";
import Landing from "./pages/Landing";
import Part1 from "./pages/Part1";
import Part2 from "./pages/Part2";
import Results from "./pages/Results";
import AdvisorCapacity from "./pages/AdvisorCapacity";
import AdvisorList from "./pages/AdvisorList";

interface AppProps {
  appBasename?: string;
  initialPath?: string;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/part1/:id" component={Part1} />
      <Route path="/part2/:id" component={Part2} />
      <Route path="/results/:id" component={Results} />
      <Route path="/advisor" component={AdvisorList} />
      <Route path="/advisor/:id" component={AdvisorCapacity} />
      <Route>
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">Page not found.</div>
      </Route>
    </Switch>
  );
}

// appBasename comes from the PlannerXchange shell — see plugin.tsx. Defaults
// let this render standalone too (local dev / main.tsx).
export default function App({ appBasename = "/" }: AppProps) {
  return (
    <Router base={appBasename}>
      <AppRoutes />
    </Router>
  );
}
