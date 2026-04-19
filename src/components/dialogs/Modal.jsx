import Card from "../ui/Card";

function Modal({ title, children, footer, width = "max-w-lg" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <Card className={`flex max-h-[90vh] w-full ${width} flex-col overflow-hidden p-5`}>
        <h3 className="font-display text-base font-semibold text-app-text">{title}</h3>
        <div className="mt-3 overflow-auto">{children}</div>
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </Card>
    </div>
  );
}

export default Modal;
