import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/ui/components/alert-dialog";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { toast } from "@repo/ui/components/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2Icon, CopyIcon, Globe2Icon, PlusIcon, SendIcon } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import type { Site } from "@repo/contracts/sites";
import { ApiError, env } from "../../../api";
import { AppShell } from "../../app-shell/app-shell";
import { sendTestEvent, verifySite } from "../services";
import { SiteSettingsDialog } from "./site-settings-dialog";
import {
  sitesQueryKey,
  sitesQueryOptions,
  useCreateSiteMutation,
  useDeleteSiteMutation,
} from "../hooks/use-sites";

export function SitesPage() {
  const sites = useQuery(sitesQueryOptions);

  return (
    <AppShell>
      <section className="grid gap-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Workspace</p>
            <h1 className="text-3xl font-extrabold tracking-tight">Sites</h1>
            <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
              A site is a domain where your Tacto pixel runs. Add one, install the snippet, then
              start showing notifications.
            </p>
          </div>
          <CreateSiteDialog />
        </div>

        {sites.isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Loading sites…
            </CardContent>
          </Card>
        ) : sites.data && sites.data.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {sites.data.map((site) => (
              <Card key={site.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Globe2Icon className="size-4 text-muted-foreground" />
                    {site.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{site.domain}</p>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  {site.pixelVerifiedAt ? (
                    <Badge className="gap-1">
                      <CheckCircle2Icon className="size-3.5" /> Pixel verified
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pixel not detected</Badge>
                  )}
                  <div className="flex items-center gap-1">
                    <InstallSiteButton site={site} />
                    <SiteSettingsDialog siteId={site.id} />
                    <DeleteSiteButton id={site.id} name={site.name} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Globe2Icon className="size-6" />
              </span>
              <div>
                <p className="font-semibold">No sites yet</p>
                <p className="text-sm text-muted-foreground">
                  Add your first site to get a pixel snippet and start showing proof.
                </p>
              </div>
              <CreateSiteDialog />
            </CardContent>
          </Card>
        )}
      </section>
    </AppShell>
  );
}

function CreateSiteDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const createSite = useCreateSiteMutation();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    createSite.mutate(
      { name: name.trim(), domain: domain.trim() },
      {
        onSuccess: () => {
          toast.success("Site created");
          setName("");
          setDomain("");
          setFieldErrors({});
          setOpen(false);
        },
        onError: (error) => {
          // Show per-field messages inline when the API returned them;
          // otherwise fall back to a toast (feedback U1).
          if (error instanceof ApiError && error.fields) {
            setFieldErrors(error.fields);
            if (!error.fields.domain && !error.fields.name) toast.error(error.message);
          } else {
            toast.error(error.message);
          }
        },
      },
    );
  }

  const domainError = fieldErrors.domain?.[0];
  const nameError = fieldErrors.name?.[0];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-fit">
          <PlusIcon className="size-4" /> New site
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Add a site</DialogTitle>
            <DialogDescription>
              Give it a name and the domain where the pixel runs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="site-name">Name</Label>
            <Input
              id="site-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (nameError) setFieldErrors((f) => ({ ...f, name: [] }));
              }}
              placeholder="My store"
              aria-invalid={nameError ? true : undefined}
              required
            />
            {nameError ? <p className="text-xs text-destructive">{nameError}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="site-domain">Domain</Label>
            <Input
              id="site-domain"
              value={domain}
              onChange={(event) => {
                setDomain(event.target.value);
                if (domainError) setFieldErrors((f) => ({ ...f, domain: [] }));
              }}
              placeholder="tokoanda.com"
              aria-invalid={domainError ? true : undefined}
              required
            />
            {domainError ? (
              <p className="text-xs text-destructive">{domainError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No http:// and no /path — for example, tokoanda.com
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createSite.isPending}>
              {createSite.isPending ? "Creating…" : "Create site"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSiteButton({ id, name }: { id: string; name: string }) {
  const deleteSite = useDeleteSiteMutation();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the site and its notifications. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() =>
              deleteSite.mutate(id, {
                onSuccess: () => toast.success("Site deleted"),
                onError: (error) => toast.error(error.message),
              })
            }
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Per-platform install guidance (feedback T5). Every platform uses the same
// snippet; only where you paste it differs.
const INSTALL_GUIDES: { value: string; label: string; steps: ReactNode }[] = [
  {
    value: "html",
    label: "HTML",
    steps: (
      <>
        Paste the snippet just before the closing <code>&lt;/body&gt;</code> tag on every page of
        your site, then redeploy.
      </>
    ),
  },
  {
    value: "gtm",
    label: "Google Tag Manager",
    steps: (
      <>
        In GTM, create a new <strong>Custom HTML</strong> tag, paste the snippet, and set the
        trigger to <strong>All Pages</strong>. Submit and publish the container.
      </>
    ),
  },
  {
    value: "shopify",
    label: "Shopify",
    steps: (
      <>
        In your admin, go to <strong>Online Store → Themes → Edit code</strong>, open{" "}
        <code>theme.liquid</code>, paste the snippet right before <code>&lt;/body&gt;</code> and
        save.
      </>
    ),
  },
  {
    value: "wordpress",
    label: "WordPress",
    steps: (
      <>
        Use a header/footer plugin (e.g. <em>WPCode</em> or <em>Insert Headers and Footers</em>) and
        paste the snippet into the <strong>Footer</strong> section, or add it before{" "}
        <code>&lt;/body&gt;</code> in your theme&apos;s <code>footer.php</code>.
      </>
    ),
  },
  {
    value: "webflow",
    label: "Webflow",
    steps: (
      <>
        Open <strong>Project Settings → Custom Code</strong> and paste the snippet into the{" "}
        <strong>Footer Code</strong> field, then publish the site.
      </>
    ),
  },
];

function InstallSiteButton({ site }: { site: Site }) {
  const queryClient = useQueryClient();
  const snippet = `<script src="${env.VITE_WIDGET_CDN_URL}/t.js" data-site="${site.siteKey}" async></script>`;

  function copy() {
    navigator.clipboard
      .writeText(snippet)
      .then(() => toast.success("Snippet copied"))
      .catch(() => toast.error("Could not copy snippet"));
  }

  const verify = useMutation({
    mutationFn: () => verifySite(site.id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: sitesQueryKey });
      if (result.verified) toast.success("Pixel detected — you're all set.");
      else
        toast.message("Pixel not detected yet", {
          description: "Make sure the snippet is live on your site, then check again.",
        });
    },
    onError: (error) => toast.error(error.message),
  });

  const testEvent = useMutation({
    mutationFn: () => sendTestEvent(site.id),
    onSuccess: () =>
      toast.success("Test event sent", {
        description: "Open your site to see the notification appear.",
      }),
    onError: (error) => toast.error(error.message),
  });

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Install
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Install the Tacto pixel</DialogTitle>
          <DialogDescription>
            Copy the snippet, then follow the steps for your platform.
          </DialogDescription>
        </DialogHeader>
        <pre className="overflow-x-auto rounded-lg border bg-muted/60 p-4 text-xs">
          <code>{snippet}</code>
        </pre>
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={copy}>
          <CopyIcon className="size-4" /> Copy snippet
        </Button>

        <Tabs defaultValue="html" className="mt-1">
          <TabsList className="flex-wrap">
            {INSTALL_GUIDES.map((guide) => (
              <TabsTrigger key={guide.value} value={guide.value}>
                {guide.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {INSTALL_GUIDES.map((guide) => (
            <TabsContent
              key={guide.value}
              value={guide.value}
              className="rounded-md border bg-muted/30 p-3 text-sm leading-6"
            >
              {guide.steps}
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {site.pixelVerifiedAt ? "Pixel verified ✓" : "Pixel not detected yet"}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={testEvent.isPending}
              onClick={() => testEvent.mutate()}
            >
              <SendIcon className="size-4" /> Send test event
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={verify.isPending}
              onClick={() => verify.mutate()}
            >
              {verify.isPending ? "Checking…" : "Verify installation"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
