import { useAuth } from "@/contexts/AuthContext";
import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useUsers, useNotifications } from "@/store";
import { api, getApiErrorMessage } from "@/services/api";
import { toast } from "@/hooks/use-toast";
import {
  Building,
  Clock,
  Calendar,
  DollarSign,
  Shield,
  Mail,
  Bell,
  Save,
  Upload,
  Globe,
  Database,
  Key,
  Home,
} from "lucide-react";

// 🧪 Mock initial settings
const mockSettings = {
  company: {
    name: "Acme Inc.",
    description: "Leading global solutions provider",
  },
  workingHours: {
    start: "09:00",
    end: "17:00",
  },
  leaves: {
    annual: 20,
    sick: 10,
  },
  payroll: {
    cycle: "monthly",
  },
  authentication: {
    twoFA: true,
  },
  notifications: {
    email: true,
    sms: false,
  },
};

export default function SettingsPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("housing");
  const [isDirty, setIsDirty] = useState(false);
  const [rentalDueDay, setRentalDueDay] = useState("5");

  const settingsQ = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await api.get<{
        rentalDueDay: number;
        reminderDaysBefore: number;
      }>("/settings");
      return res.data;
    },
  });

  useEffect(() => {
    if (settingsQ.data) {
      setRentalDueDay(String(settingsQ.data.rentalDueDay));
    }
  }, [settingsQ.data]);

  const saveHousing = useMutation({
    mutationFn: async () => {
      const res = await api.put("/settings", {
        rentalDueDay: Number(rentalDueDay),
      });
      return res.data;
    },
    onSuccess: () => {
      toast({ title: "Housing settings saved" });
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["rentals"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => {
      toast({
        title: "Could not save settings",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const [companySettings, setCompanySettings] = useState({
    name: "Acme Corporation",
    address: "123 Business Ave, Suite 100, New York, NY 10001",
    phone: "+1 (555) 123-4567",
    email: "info@acmecorp.com",
    website: "https://acmecorp.com",
    taxId: "12-3456789",
  });

  const [workingHours, setWorkingHours] = useState({
    monday: { enabled: true, start: "09:00", end: "17:00" },
    tuesday: { enabled: true, start: "09:00", end: "17:00" },
    wednesday: { enabled: true, start: "09:00", end: "17:00" },
    thursday: { enabled: true, start: "09:00", end: "17:00" },
    friday: { enabled: true, start: "09:00", end: "17:00" },
    saturday: { enabled: false, start: "09:00", end: "17:00" },
    sunday: { enabled: false, start: "09:00", end: "17:00" },
  });

  const [leaveSettings, setLeaveSettings] = useState({
    annualLeaveDays: 20,
    sickLeaveDays: 10,
    maternityLeaveDays: 90,
    paternityLeaveDays: 14,
    carryForwardDays: 5,
    maxCarryForward: 25,
    probationPeriodDays: 90,
  });

  const [payrollSettings, setPayrollSettings] = useState({
    currency: "USD",
    payFrequency: "monthly",
    taxSettings: {
      federalTaxRate: 22,
      stateTaxRate: 6.5,
      socialSecurityRate: 6.2,
      medicareRate: 1.45,
    },
  });

  const [authSettings, setAuthSettings] = useState({
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: false,
      maxAge: 90,
    },
    sessionTimeout: 480,
    twoFactorEnabled: false,
    ssoEnabled: false,
    ssoProvider: "",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    emailEnabled: true,
    smtpSettings: {
      host: "",
      port: 587,
      username: "",
      password: "",
      encryption: "tls", // 'none' | 'tls' | 'ssl'
    },
    slackEnabled: false,
    slackWebhookUrl: "",
  });

  const handleSaveSettings = () => {
    const newSettings = {
      company: companySettings,
      workingHours,
      leaves: leaveSettings,
      payroll: payrollSettings,
      authentication: authSettings,
      notifications: notificationSettings,
    };

    console.log("✅ Saved settings:", newSettings);
    setIsDirty(false);
    alert("Settings saved successfully!");
  };

  const handleFormChange = () => {
    setIsDirty(true);
  };
  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground">
            Configure system-wide settings and preferences
          </p>
        </div>
        {isDirty && (
          <Button onClick={handleSaveSettings}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="housing">Housing</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="working-hours">Working Hours</TabsTrigger>
          <TabsTrigger value="leaves">Leave Policies</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="housing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Rental due day
              </CardTitle>
              <CardDescription>
                One global day of the month when rent is due for every active
                rental. Reminders appear 5 days before that day.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-w-md">
              {settingsQ.error ? (
                <p className="text-sm text-destructive">
                  {getApiErrorMessage(settingsQ.error)}
                </p>
              ) : null}
              <div>
                <Label htmlFor="rental-due-day">Due day of month (1–28)</Label>
                <Input
                  id="rental-due-day"
                  type="number"
                  min={1}
                  max={28}
                  value={rentalDueDay}
                  onChange={(e) => setRentalDueDay(e.target.value)}
                  disabled={settingsQ.isLoading}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Reminder lead time is fixed at{" "}
                {settingsQ.data?.reminderDaysBefore ?? 5} days before the due
                day.
              </p>
              <Button
                onClick={() => saveHousing.mutate()}
                disabled={
                  !hasPermission("settings.write") ||
                  saveHousing.isPending ||
                  settingsQ.isLoading
                }
              >
                <Save className="mr-2 h-4 w-4" />
                {saveHousing.isPending ? "Saving…" : "Save housing settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Company Information
              </CardTitle>
              <CardDescription>
                Basic company details and branding
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={companySettings.name}
                  onChange={(e) => {
                    setCompanySettings((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }));
                    handleFormChange();
                  }}
                  placeholder="Acme Corporation"
                />
              </div>
              <div>
                <Label htmlFor="company-address">Address</Label>
                <Textarea
                  id="company-address"
                  value={companySettings.address}
                  onChange={(e) => {
                    setCompanySettings((prev) => ({
                      ...prev,
                      address: e.target.value,
                    }));
                    handleFormChange();
                  }}
                  placeholder="123 Business Ave, Suite 100, New York, NY 10001"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company-phone">Phone</Label>
                  <Input
                    id="company-phone"
                    value={companySettings.phone}
                    onChange={(e) => {
                      setCompanySettings((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }));
                      handleFormChange();
                    }}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="company-email">Email</Label>
                  <Input
                    id="company-email"
                    type="email"
                    value={companySettings.email}
                    onChange={(e) => {
                      setCompanySettings((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }));
                      handleFormChange();
                    }}
                    placeholder="info@acmecorp.com"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="company-website">Website</Label>
                  <Input
                    id="company-website"
                    value={companySettings.website || ""}
                    onChange={(e) => {
                      setCompanySettings((prev) => ({
                        ...prev,
                        website: e.target.value,
                      }));
                      handleFormChange();
                    }}
                    placeholder="https://acmecorp.com"
                  />
                </div>
                <div>
                  <Label htmlFor="company-tax-id">Tax ID</Label>
                  <Input
                    id="company-tax-id"
                    value={companySettings.taxId || ""}
                    onChange={(e) => {
                      setCompanySettings((prev) => ({
                        ...prev,
                        taxId: e.target.value,
                      }));
                      handleFormChange();
                    }}
                    placeholder="12-3456789"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="company-logo">Company Logo</Label>
                <div className="flex items-center gap-4 mt-2">
                  <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <Upload className="h-6 w-6 text-gray-400" />
                  </div>
                  <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Logo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="working-hours" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Working Hours Configuration
              </CardTitle>
              <CardDescription>
                Set standard working hours for each day of the week
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {days.map((day) => (
                <div
                  key={day}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={
                        workingHours[day as keyof typeof workingHours].enabled
                      }
                      onCheckedChange={(checked) => {
                        setWorkingHours((prev) => ({
                          ...prev,
                          [day]: {
                            ...prev[day as keyof typeof prev],
                            enabled: checked,
                          },
                        }));
                        handleFormChange();
                      }}
                    />
                    <span className="font-medium capitalize w-20">{day}</span>
                  </div>
                  {workingHours[day as keyof typeof workingHours].enabled && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={
                          workingHours[day as keyof typeof workingHours].start
                        }
                        onChange={(e) => {
                          setWorkingHours((prev) => ({
                            ...prev,
                            [day]: {
                              ...prev[day as keyof typeof prev],
                              start: e.target.value,
                            },
                          }));
                          handleFormChange();
                        }}
                        className="w-32"
                      />
                      <span>to</span>
                      <Input
                        type="time"
                        value={
                          workingHours[day as keyof typeof workingHours].end
                        }
                        onChange={(e) => {
                          setWorkingHours((prev) => ({
                            ...prev,
                            [day]: {
                              ...prev[day as keyof typeof prev],
                              end: e.target.value,
                            },
                          }));
                          handleFormChange();
                        }}
                        className="w-32"
                      />
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaves" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Leave Policies
              </CardTitle>
              <CardDescription>
                Configure leave entitlements and policies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="annual-leave">Annual Leave Days</Label>
                  <Input
                    id="annual-leave"
                    type="number"
                    value={leaveSettings.annualLeaveDays}
                    onChange={(e) => {
                      setLeaveSettings((prev) => ({
                        ...prev,
                        annualLeaveDays: parseInt(e.target.value) || 0,
                      }));
                      handleFormChange();
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="sick-leave">Sick Leave Days</Label>
                  <Input
                    id="sick-leave"
                    type="number"
                    value={leaveSettings.sickLeaveDays}
                    onChange={(e) => {
                      setLeaveSettings((prev) => ({
                        ...prev,
                        sickLeaveDays: parseInt(e.target.value) || 0,
                      }));
                      handleFormChange();
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maternity-leave">Maternity Leave Days</Label>
                  <Input
                    id="maternity-leave"
                    type="number"
                    value={leaveSettings.maternityLeaveDays}
                    onChange={(e) => {
                      setLeaveSettings((prev) => ({
                        ...prev,
                        maternityLeaveDays: parseInt(e.target.value) || 0,
                      }));
                      handleFormChange();
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="paternity-leave">Paternity Leave Days</Label>
                  <Input
                    id="paternity-leave"
                    type="number"
                    value={leaveSettings.paternityLeaveDays}
                    onChange={(e) => {
                      setLeaveSettings((prev) => ({
                        ...prev,
                        paternityLeaveDays: parseInt(e.target.value) || 0,
                      }));
                      handleFormChange();
                    }}
                  />
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="carry-forward">Carry Forward Days</Label>
                  <Input
                    id="carry-forward"
                    type="number"
                    value={leaveSettings.carryForwardDays}
                    onChange={(e) => {
                      setLeaveSettings((prev) => ({
                        ...prev,
                        carryForwardDays: parseInt(e.target.value) || 0,
                      }));
                      handleFormChange();
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="max-carry-forward">Max Carry Forward</Label>
                  <Input
                    id="max-carry-forward"
                    type="number"
                    value={leaveSettings.maxCarryForward}
                    onChange={(e) => {
                      setLeaveSettings((prev) => ({
                        ...prev,
                        maxCarryForward: parseInt(e.target.value) || 0,
                      }));
                      handleFormChange();
                    }}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="probation-period">
                  Probation Period (Days)
                </Label>
                <Input
                  id="probation-period"
                  type="number"
                  value={leaveSettings.probationPeriodDays}
                  onChange={(e) => {
                    setLeaveSettings((prev) => ({
                      ...prev,
                      probationPeriodDays: parseInt(e.target.value) || 0,
                    }));
                    handleFormChange();
                  }}
                  className="w-48"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Payroll Settings
              </CardTitle>
              <CardDescription>
                Configure payroll processing and tax settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Select
                    value={payrollSettings.currency}
                    onValueChange={(value) => {
                      setPayrollSettings((prev) => ({
                        ...prev,
                        currency: value,
                      }));
                      handleFormChange();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                      <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pay-frequency">Pay Frequency</Label>
                  <Select
                    value={payrollSettings.payFrequency}
                    onValueChange={(value) => {
                      setPayrollSettings((prev) => ({
                        ...prev,
                        payFrequency: value as any,
                      }));
                      handleFormChange();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div>
                <h3 className="font-medium mb-4">Tax Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="federal-tax">Federal Tax Rate (%)</Label>
                    <Input
                      id="federal-tax"
                      type="number"
                      step="0.01"
                      value={payrollSettings.taxSettings.federalTaxRate}
                      onChange={(e) => {
                        setPayrollSettings((prev) => ({
                          ...prev,
                          taxSettings: {
                            ...prev.taxSettings,
                            federalTaxRate: parseFloat(e.target.value) || 0,
                          },
                        }));
                        handleFormChange();
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="state-tax">State Tax Rate (%)</Label>
                    <Input
                      id="state-tax"
                      type="number"
                      step="0.01"
                      value={payrollSettings.taxSettings.stateTaxRate}
                      onChange={(e) => {
                        setPayrollSettings((prev) => ({
                          ...prev,
                          taxSettings: {
                            ...prev.taxSettings,
                            stateTaxRate: parseFloat(e.target.value) || 0,
                          },
                        }));
                        handleFormChange();
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <Label htmlFor="social-security">
                      Social Security Rate (%)
                    </Label>
                    <Input
                      id="social-security"
                      type="number"
                      step="0.01"
                      value={payrollSettings.taxSettings.socialSecurityRate}
                      onChange={(e) => {
                        setPayrollSettings((prev) => ({
                          ...prev,
                          taxSettings: {
                            ...prev.taxSettings,
                            socialSecurityRate: parseFloat(e.target.value) || 0,
                          },
                        }));
                        handleFormChange();
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="medicare">Medicare Rate (%)</Label>
                    <Input
                      id="medicare"
                      type="number"
                      step="0.01"
                      value={payrollSettings.taxSettings.medicareRate}
                      onChange={(e) => {
                        setPayrollSettings((prev) => ({
                          ...prev,
                          taxSettings: {
                            ...prev.taxSettings,
                            medicareRate: parseFloat(e.target.value) || 0,
                          },
                        }));
                        handleFormChange();
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security & Authentication
              </CardTitle>
              <CardDescription>
                Configure security policies and authentication settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-4">Password Policy</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min-length">Minimum Length</Label>
                    <Input
                      id="min-length"
                      type="number"
                      value={authSettings.passwordPolicy.minLength}
                      onChange={(e) => {
                        setAuthSettings((prev) => ({
                          ...prev,
                          passwordPolicy: {
                            ...prev.passwordPolicy,
                            minLength: parseInt(e.target.value) || 8,
                          },
                        }));
                        handleFormChange();
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="max-age">Password Max Age (Days)</Label>
                    <Input
                      id="max-age"
                      type="number"
                      value={authSettings.passwordPolicy.maxAge}
                      onChange={(e) => {
                        setAuthSettings((prev) => ({
                          ...prev,
                          passwordPolicy: {
                            ...prev.passwordPolicy,
                            maxAge: parseInt(e.target.value) || 90,
                          },
                        }));
                        handleFormChange();
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-3 mt-4">
                  {[
                    {
                      key: "requireUppercase",
                      label: "Require Uppercase Letters",
                    },
                    {
                      key: "requireLowercase",
                      label: "Require Lowercase Letters",
                    },
                    { key: "requireNumbers", label: "Require Numbers" },
                    {
                      key: "requireSpecialChars",
                      label: "Require Special Characters",
                    },
                  ].map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{label}</span>
                      <Switch
                        checked={
                          authSettings.passwordPolicy[
                            key as keyof typeof authSettings.passwordPolicy
                          ] as boolean
                        }
                        onCheckedChange={(checked) => {
                          setAuthSettings((prev) => ({
                            ...prev,
                            passwordPolicy: {
                              ...prev.passwordPolicy,
                              [key]: checked,
                            },
                          }));
                          handleFormChange();
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
              <div className="space-y-4">
                <h3 className="font-medium">Session & Access</h3>
                <div>
                  <Label htmlFor="session-timeout">
                    Session Timeout (Minutes)
                  </Label>
                  <Input
                    id="session-timeout"
                    type="number"
                    value={authSettings.sessionTimeout}
                    onChange={(e) => {
                      setAuthSettings((prev) => ({
                        ...prev,
                        sessionTimeout: parseInt(e.target.value) || 480,
                      }));
                      handleFormChange();
                    }}
                    className="w-48"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">
                      Two-Factor Authentication
                    </span>
                    <p className="text-sm text-muted-foreground">
                      Require 2FA for all users
                    </p>
                  </div>
                  <Switch
                    checked={authSettings.twoFactorEnabled}
                    onCheckedChange={(checked) => {
                      setAuthSettings((prev) => ({
                        ...prev,
                        twoFactorEnabled: checked,
                      }));
                      handleFormChange();
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">Single Sign-On (SSO)</span>
                    <p className="text-sm text-muted-foreground">
                      Enable SSO integration
                    </p>
                  </div>
                  <Switch
                    checked={authSettings.ssoEnabled}
                    onCheckedChange={(checked) => {
                      setAuthSettings((prev) => ({
                        ...prev,
                        ssoEnabled: checked,
                      }));
                      handleFormChange();
                    }}
                  />
                </div>
                {authSettings.ssoEnabled && (
                  <div>
                    <Label htmlFor="sso-provider">SSO Provider</Label>
                    <Input
                      id="sso-provider"
                      value={authSettings.ssoProvider || ""}
                      onChange={(e) => {
                        setAuthSettings((prev) => ({
                          ...prev,
                          ssoProvider: e.target.value,
                        }));
                        handleFormChange();
                      }}
                      placeholder="e.g., Azure AD, Okta, Google"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure system notification preferences and channels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">Email Notifications</span>
                  <p className="text-sm text-muted-foreground">
                    Send notifications via email
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.emailEnabled}
                  onCheckedChange={(checked) => {
                    setNotificationSettings((prev) => ({
                      ...prev,
                      emailEnabled: checked,
                    }));
                    handleFormChange();
                  }}
                />
              </div>
              {notificationSettings.emailEnabled &&
                notificationSettings.smtpSettings && (
                  <div className="space-y-4 pl-4 border-l-2 border-gray-200">
                    <h4 className="font-medium">SMTP Configuration</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="smtp-host">SMTP Host</Label>
                        <Input
                          id="smtp-host"
                          value={notificationSettings.smtpSettings.host}
                          onChange={(e) => {
                            setNotificationSettings((prev) => ({
                              ...prev,
                              smtpSettings: prev.smtpSettings
                                ? {
                                    ...prev.smtpSettings,
                                    host: e.target.value,
                                  }
                                : undefined,
                            }));
                            handleFormChange();
                          }}
                          placeholder="smtp.gmail.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="smtp-port">Port</Label>
                        <Input
                          id="smtp-port"
                          type="number"
                          value={notificationSettings.smtpSettings.port}
                          onChange={(e) => {
                            setNotificationSettings((prev) => ({
                              ...prev,
                              smtpSettings: prev.smtpSettings
                                ? {
                                    ...prev.smtpSettings,
                                    port: parseInt(e.target.value) || 587,
                                  }
                                : undefined,
                            }));
                            handleFormChange();
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="smtp-username">Username</Label>
                        <Input
                          id="smtp-username"
                          value={notificationSettings.smtpSettings.username}
                          onChange={(e) => {
                            setNotificationSettings((prev) => ({
                              ...prev,
                              smtpSettings: prev.smtpSettings
                                ? {
                                    ...prev.smtpSettings,
                                    username: e.target.value,
                                  }
                                : undefined,
                            }));
                            handleFormChange();
                          }}
                        />
                      </div>
                      <div>
                        <Label htmlFor="smtp-password">Password</Label>
                        <Input
                          id="smtp-password"
                          type="password"
                          value={notificationSettings.smtpSettings.password}
                          onChange={(e) => {
                            setNotificationSettings((prev) => ({
                              ...prev,
                              smtpSettings: prev.smtpSettings
                                ? {
                                    ...prev.smtpSettings,
                                    password: e.target.value,
                                  }
                                : undefined,
                            }));
                            handleFormChange();
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="smtp-encryption">Encryption</Label>
                      <Select
                        value={notificationSettings.smtpSettings.encryption}
                        onValueChange={(value) => {
                          setNotificationSettings((prev) => ({
                            ...prev,
                            smtpSettings: prev.smtpSettings
                              ? {
                                  ...prev.smtpSettings,
                                  encryption: value as any,
                                }
                              : undefined,
                          }));
                          handleFormChange();
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="tls">TLS</SelectItem>
                          <SelectItem value="ssl">SSL</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">Slack Integration</span>
                  <p className="text-sm text-muted-foreground">
                    Send notifications to Slack
                  </p>
                </div>
                <Switch
                  checked={notificationSettings.slackEnabled}
                  onCheckedChange={(checked) => {
                    setNotificationSettings((prev) => ({
                      ...prev,
                      slackEnabled: checked,
                    }));
                    handleFormChange();
                  }}
                />
              </div>
              {notificationSettings.slackEnabled && (
                <div className="pl-4 border-l-2 border-gray-200">
                  <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
                  <Input
                    id="slack-webhook"
                    value={notificationSettings.slackWebhookUrl || ""}
                    onChange={(e) => {
                      setNotificationSettings((prev) => ({
                        ...prev,
                        slackWebhookUrl: e.target.value,
                      }));
                      handleFormChange();
                    }}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
