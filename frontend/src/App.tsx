import { ThemeProvider } from "./components/theme-provider";
import { ThemeToggle } from "./components/theme-toggle";
import Index from "./pages/Index";

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      <Index />
    </ThemeProvider>
  );
}

export default App;
