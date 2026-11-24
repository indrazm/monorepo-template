import * as React from "react";

function FormElement(props: React.ComponentProps<"form">) {
  return <form data-slot="form" {...props} />;
}

export { FormElement };
