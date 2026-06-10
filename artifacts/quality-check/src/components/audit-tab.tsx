import React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isPast, parseISO, startOfWeek, isAfter } from "date-fns";
import {
  PlusCircle,
  Loader2,
  Trash2,
  FilePenLine,
  ClipboardCheck,
  CalendarClock,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  ListChecks,
  Filter,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

interface Checksheet {
  id: number;
  itemName: string;
  department: string;
  machine: string;
  measurementFields: {
    fieldName: string;
    fieldType: "Numeric" | "Boolean" | "Text";
    unit?: string;
    lsl?: number;
    usl?: number;
  }[];
}

interface UserOption {
  id: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
}

interface Audit {
  id: number;
  title: string;
  checksheetId: number | null;
  checksheetName: string;
  department: string;
  machine: string;
  assigneeId: string | null;
  assigneeName: string | null;
  scheduledDate: string;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  status: "pending" | "overdue" | "completed";
  completedAt: string | null;
  createdAt: string;
}

const auditFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  checksheetId: z.string().min(1, "Check sheet is required"),
  assigneeId: z.string().optional(),
  scheduledDate: z.string().min(1, "Due date is required"),
  recurrence: z.enum(["none", "daily", "weekly", "monthly"]),
});

function getAuditStatus(audit: Audit): "pending" | "overdue" | "completed" {
  return audit.status;
}

function StatusBadge({ status }: { status: "pending" | "overdue" | "completed" }) {
  if (status === "completed") return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Completed</Badge>;
  if (status === "overdue") return <Badge variant="destructive">Overdue</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
}

function RecurrenceBadge({ recurrence }: { recurrence: Audit["recurrence"] }) {
  if (recurrence === "none") return null;
  const labels = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };
  return (
    <Badge variant="outline" className="gap-1">
      <RefreshCw className="h-3 w-3" />
      {labels[recurrence]}
    </Badge>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  colorClass: string;
  bgClass: string;
}

function StatCard({ icon, label, value, colorClass, bgClass }: StatCardProps) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${bgClass}`}>
      <div className={`shrink-0 ${colorClass}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function AuditTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isManager = user?.role === "manager";

  const [audits, setAudits] = React.useState<Audit[]>([]);
  const [checksheets, setChecksheets] = React.useState<Checksheet[]>([]);
  const [users, setUsers] = React.useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingAudit, setEditingAudit] = React.useState<Audit | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const [completingAudit, setCompletingAudit] = React.useState<Audit | null>(null);
  const [completingChecksheet, setCompletingChecksheet] = React.useState<Checksheet | null>(null);
  const [dynamicSchema, setDynamicSchema] = React.useState(z.object({}));
  const [isSubmittingComplete, setIsSubmittingComplete] = React.useState(false);

  const [historyOpen, setHistoryOpen] = React.useState(true);
  const [filterAssignee, setFilterAssignee] = React.useState<string>("all");

  const form = useForm<z.infer<typeof auditFormSchema>>({
    resolver: zodResolver(auditFormSchema),
    defaultValues: { title: "", checksheetId: "", assigneeId: "unassigned", scheduledDate: "", recurrence: "none" },
  });

  const completionForm = useForm<Record<string, any>>({
    resolver: zodResolver(dynamicSchema),
    defaultValues: {},
  });

  const fetchAll = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [auditData, sheetData] = await Promise.all([
        api.get<Audit[]>("/api/audits"),
        api.get<Checksheet[]>("/api/checksheets"),
      ]);
      setAudits(auditData);
      setChecksheets(sheetData);
      if (isManager) {
        const userData = await api.get<UserOption[]>("/api/users");
        setUsers(userData);
      }
    } catch {
      toast({ title: "Error", description: "Could not load audit data.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, isManager]);

  React.useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  React.useEffect(() => {
    if (completingAudit) {
      const cs = checksheets.find((c) => c.id === completingAudit.checksheetId);
      setCompletingChecksheet(cs || null);
      if (cs) {
        const shape: Record<string, any> = {};
        const defaults: Record<string, any> = {};
        for (const f of cs.measurementFields) {
          if (f.fieldType === "Numeric") {
            shape[f.fieldName] = z.coerce.number();
            defaults[f.fieldName] = f.lsl !== undefined && f.usl !== undefined ? (f.lsl + f.usl) / 2 : 0;
          } else if (f.fieldType === "Boolean") {
            shape[f.fieldName] = z.boolean();
            defaults[f.fieldName] = false;
          } else {
            shape[f.fieldName] = z.string().min(1);
            defaults[f.fieldName] = "";
          }
        }
        setDynamicSchema(z.object(shape));
        completionForm.reset(defaults);
      }
    }
  }, [completingAudit, checksheets, completionForm]);

  const handleOpenCreate = () => {
    setEditingAudit(null);
    form.reset({ title: "", checksheetId: "", assigneeId: "unassigned", scheduledDate: "", recurrence: "none" });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (audit: Audit) => {
    setEditingAudit(audit);
    form.reset({
      title: audit.title,
      checksheetId: String(audit.checksheetId ?? ""),
      assigneeId: audit.assigneeId ?? "unassigned",
      scheduledDate: format(new Date(audit.scheduledDate), "yyyy-MM-dd'T'HH:mm"),
      recurrence: audit.recurrence,
    });
    setIsFormOpen(true);
  };

  const handleSaveAudit = async (values: z.infer<typeof auditFormSchema>) => {
    setIsSaving(true);
    try {
      const cs = checksheets.find((c) => c.id === Number(values.checksheetId));
      const assignee = users.find((u) => u.id === values.assigneeId);
      const payload = {
        title: values.title,
        checksheetId: Number(values.checksheetId),
        checksheetName: cs?.itemName ?? "",
        department: cs?.department ?? "",
        machine: cs?.machine ?? "",
        assigneeId: values.assigneeId === "unassigned" ? null : values.assigneeId,
        assigneeName: assignee ? (assignee.firstName || assignee.username) : null,
        scheduledDate: new Date(values.scheduledDate).toISOString(),
        recurrence: values.recurrence,
      };

      if (editingAudit) {
        await api.put(`/api/audits/${editingAudit.id}`, payload);
        toast({ title: "Audit Updated" });
      } else {
        await api.post("/api/audits", payload);
        toast({ title: "Audit Created" });
      }
      setIsFormOpen(false);
      await fetchAll();
    } catch {
      toast({ title: "Error", description: "Could not save audit.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (auditId: number) => {
    try {
      await api.delete(`/api/audits/${auditId}`);
      toast({ title: "Audit Deleted" });
      await fetchAll();
    } catch {
      toast({ title: "Error", description: "Could not delete audit.", variant: "destructive" });
    }
  };

  const handleCompleteSubmit = async (values: Record<string, any>) => {
    if (!completingAudit) return;
    setIsSubmittingComplete(true);
    try {
      await api.post(`/api/audits/${completingAudit.id}/complete`, {
        measurements: values,
        issues: [],
      });
      toast({ title: "Audit Completed", description: "Measurement recorded successfully." });
      setCompletingAudit(null);
      setCompletingChecksheet(null);
      await fetchAll();
    } catch {
      toast({ title: "Error", description: "Could not complete audit.", variant: "destructive" });
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  const selectedChecksheetId = form.watch("checksheetId");
  const selectedCs = checksheets.find((c) => c.id === Number(selectedChecksheetId));

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const stats = React.useMemo(() => {
    const total = audits.length;
    const pending = audits.filter((a) => a.status === "pending").length;
    const overdue = audits.filter((a) => a.status === "overdue").length;
    const completedThisWeek = audits.filter(
      (a) => a.status === "completed" && a.completedAt && isAfter(new Date(a.completedAt), weekStart)
    ).length;
    return { total, pending, overdue, completedThisWeek };
  }, [audits, weekStart]);

  const baseAudits = isManager ? audits : audits.filter((a) => {
    const isAssignedToMe = a.assigneeId === user?.id;
    const isUnassigned = a.assigneeId === null;
    const isActionable = a.status !== "completed";
    return isAssignedToMe || (isUnassigned && isActionable);
  });

  const filteredByAssignee = (isManager && filterAssignee !== "all")
    ? baseAudits.filter((a) => {
        if (filterAssignee === "unassigned") return a.assigneeId === null;
        return a.assigneeId === filterAssignee;
      })
    : baseAudits;

  const activeAudits = filteredByAssignee.filter((a) => a.status !== "completed");
  const completedAudits = filteredByAssignee.filter((a) => a.status === "completed");

  const assigneeOptions = React.useMemo(() => {
    const seen = new Set<string>();
    const opts: { id: string; label: string }[] = [];
    for (const a of audits) {
      if (a.assigneeId && !seen.has(a.assigneeId)) {
        seen.add(a.assigneeId);
        opts.push({ id: a.assigneeId, label: a.assigneeName ?? a.assigneeId });
      }
    }
    return opts;
  }, [audits]);

  const AuditTableRows = ({ rows }: { rows: Audit[] }) => (
    <>
      {rows.map((audit) => {
        const status = getAuditStatus(audit);
        return (
          <TableRow key={audit.id} className={status === "overdue" ? "bg-red-50/50" : ""}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                {audit.title}
                <RecurrenceBadge recurrence={audit.recurrence} />
              </div>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{audit.checksheetName}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {audit.department} / {audit.machine}
            </TableCell>
            {isManager && (
              <TableCell className="text-sm">
                {audit.assigneeName ?? <span className="text-muted-foreground italic">Any inspector</span>}
              </TableCell>
            )}
            <TableCell className="text-sm">
              <div className="flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                {format(new Date(audit.scheduledDate), "dd MMM yyyy HH:mm")}
              </div>
            </TableCell>
            {status === "completed" ? (
              <TableCell className="text-sm text-muted-foreground">
                {audit.completedAt ? format(new Date(audit.completedAt), "dd MMM yyyy HH:mm") : "—"}
              </TableCell>
            ) : (
              <TableCell><StatusBadge status={status} /></TableCell>
            )}
            <TableCell>
              <div className="flex gap-1">
                {status !== "completed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompletingAudit(audit)}
                  >
                    Complete
                  </Button>
                )}
                {isManager && (
                  <>
                    {status !== "completed" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(audit)}
                      >
                        <FilePenLine className="h-4 w-4" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Audit?</AlertDialogTitle>
                          <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(audit.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );

  return (
    <div className="space-y-4">
      {isManager && !isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={<ListChecks className="h-5 w-5" />}
            label="Total Audits"
            value={stats.total}
            colorClass="text-primary"
            bgClass="bg-background"
          />
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="Pending"
            value={stats.pending}
            colorClass="text-amber-600"
            bgClass="bg-amber-50/60"
          />
          <StatCard
            icon={<AlertCircle className="h-5 w-5" />}
            label="Overdue"
            value={stats.overdue}
            colorClass="text-red-600"
            bgClass="bg-red-50/60"
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label="Completed This Week"
            value={stats.completedThisWeek}
            colorClass="text-green-600"
            bgClass="bg-green-50/60"
          />
        </div>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                {isManager ? "Audit Management" : "My Assigned Audits"}
              </CardTitle>
              <CardDescription>
                {isManager
                  ? "Plan, assign and track quality audits."
                  : "View and complete your assigned audit tasks."}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isManager && assigneeOptions.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                    <SelectTrigger className="h-8 text-sm w-44">
                      <SelectValue placeholder="Filter by assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All assignees</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {assigneeOptions.map((opt) => (
                        <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {isManager && (
                <Button onClick={handleOpenCreate} size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Audit
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activeAudits.length === 0 && completedAudits.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">
              {isManager ? "No audits yet. Create one to get started." : "No audits assigned to you."}
            </p>
          ) : (
            <div className="space-y-6">
              {activeAudits.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Check Sheet</TableHead>
                        <TableHead>Dept / Machine</TableHead>
                        {isManager && <TableHead>Assigned To</TableHead>}
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AuditTableRows rows={activeAudits} />
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No active audits.
                </p>
              )}

              {completedAudits.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-sm font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Completion History
                      <Badge variant="secondary" className="font-normal">
                        {completedAudits.length}
                      </Badge>
                    </span>
                    {historyOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {historyOpen && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/20">
                            <TableHead>Title</TableHead>
                            <TableHead>Check Sheet</TableHead>
                            <TableHead>Dept / Machine</TableHead>
                            {isManager && <TableHead>Completed By</TableHead>}
                            <TableHead>Due Date</TableHead>
                            <TableHead>Completed At</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AuditTableRows rows={completedAudits} />
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Audit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingAudit ? "Edit Audit" : "Create New Audit"}</DialogTitle>
            <DialogDescription>
              {editingAudit ? "Update the audit details." : "Plan a new quality audit and assign it to an inspector."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveAudit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Audit Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Weekly Injection Quality Check" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="checksheetId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check Sheet</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!!editingAudit}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a check sheet" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {checksheets.map((cs) => (
                          <SelectItem key={cs.id} value={String(cs.id)}>
                            {cs.itemName} — {cs.department} / {cs.machine}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedCs && (
                      <FormDescription className="text-xs">
                        {selectedCs.measurementFields.length} measurement field(s)
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign To</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an inspector" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">Any inspector</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.firstName || u.username} ({u.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date &amp; Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="recurrence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recurrence</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">One-time only</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingAudit ? "Save Changes" : "Create Audit"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Complete Audit Dialog */}
      <Dialog open={!!completingAudit} onOpenChange={(open) => { if (!open) { setCompletingAudit(null); setCompletingChecksheet(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Audit: {completingAudit?.title}</DialogTitle>
            <DialogDescription>
              Fill in the measurement values for {completingAudit?.checksheetName} — {completingAudit?.department} / {completingAudit?.machine}
            </DialogDescription>
          </DialogHeader>
          {completingChecksheet ? (
            <Form {...completionForm}>
              <form onSubmit={completionForm.handleSubmit(handleCompleteSubmit)} className="space-y-4">
                {completingChecksheet.measurementFields.map((field, idx) => (
                  <FormField
                    key={idx}
                    control={completionForm.control}
                    name={field.fieldName as any}
                    render={({ field: formField }) => (
                      <FormItem>
                        <FormLabel>
                          {field.fieldName} {field.unit ? `(${field.unit})` : ""}
                        </FormLabel>
                        <FormControl>
                          {field.fieldType === "Numeric" ? (
                            <Input type="number" step="any" {...formField} value={formField.value ?? ""} />
                          ) : field.fieldType === "Text" ? (
                            <Input type="text" {...formField} value={formField.value ?? ""} />
                          ) : (
                            <Controller
                              name={field.fieldName as any}
                              control={completionForm.control}
                              render={({ field: cf }) => (
                                <Select onValueChange={(v) => cf.onChange(v === "true")} value={String(cf.value ?? "false")}>
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="true">OK</SelectItem>
                                    <SelectItem value="false">Not OK</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          )}
                        </FormControl>
                        {field.fieldType === "Numeric" && field.lsl !== undefined && field.usl !== undefined && (
                          <FormDescription>Standard: {field.lsl} – {field.usl}</FormDescription>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setCompletingAudit(null); setCompletingChecksheet(null); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmittingComplete}>
                    {isSubmittingComplete && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Submit &amp; Mark Complete
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            <p className="text-sm text-muted-foreground py-4">
              No check sheet found for this audit. Ask your manager to verify the audit configuration.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
