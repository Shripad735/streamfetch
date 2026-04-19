function Separator({ className = "" }) {
  return <div className={`h-px w-full bg-app-border ${className}`.trim()} aria-hidden="true" />;
}

export default Separator;
