import { Route, Switch } from "wouter";
import Landing from "./pages/Landing";
import Part1 from "./pages/Part1";
import Part2 from "./pages/Part2";
import Part3 from "./pages/Part3";
import Results from "./pages/Results";
import AdvisorCapacity from "./pages/AdvisorCapacity";
import AdvisorList from "./pages/AdvisorList";

export default function App() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/part1" component={Part1} />
      <Route path="/part2" component={Part2} />
      <Route path="/part3" component={Part3} />
      <Route path="/results/:id" component={Results} />
      <Route path="/advisor" component={AdvisorList} />
      <Route path="/advisor/:id" component={AdvisorCapacity} />
      <Route>
        <div className="flex min-h-screen items-center justify-center text-muted-foreground">Page not found.</div>
      </Route>
    </Switch>
  );
}
