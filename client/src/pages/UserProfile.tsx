import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useAuth as useAuthHook } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, ArrowLeft, LogOut, Mail, User, Calendar } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatDistanceToNow } from "date-fns";

export default function UserProfile() {
  const { user, logout, isAuthenticated } = useAuthHook();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("profile");

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Not Authenticated</h1>
          <p className="text-gray-600 mb-4">Please sign in to view your profile.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <p className="text-sm text-gray-600">Manage your account settings</p>
          </div>
        </div>
        <Button onClick={logout} variant="outline" size="sm">
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">Profile Information</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <ProfileTab user={user} />
          </TabsContent>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <PreferencesTab user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/**
 * Profile Information Tab
 */
interface UserType {
  name?: string | null;
  email?: string | null;
  role?: string;
  createdAt?: Date | string;
  lastSignedIn?: Date | string;
  id?: number;
  openId?: string;
  loginMethod?: string | null;
  updatedAt?: Date | string;
}

function ProfileTab({ user }: { user: UserType }) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = () => {
    // TODO: Implement profile update mutation
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      {/* User Avatar Section */}
      <Card className="p-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">{user?.name || "User"}</h2>
            <p className="text-gray-600">{user?.email}</p>
            <p className="text-sm text-gray-500 mt-1">
              Role: <span className="font-semibold capitalize">{user?.role || "user"}</span>
            </p>
          </div>
        </div>
      </Card>

      {/* Profile Information */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Account Information</h3>
          <Button
            variant={isEditing ? "default" : "outline"}
            size="sm"
            onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
          >
            {isEditing ? "Save Changes" : "Edit Profile"}
          </Button>
        </div>

        <div className="space-y-4">
          {/* Name Field */}
          <div>
            <Label htmlFor="name" className="text-sm font-medium">
              Full Name
            </Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              disabled={!isEditing}
              className="mt-1"
            />
          </div>

          {/* Email Field */}
          <div>
            <Label htmlFor="email" className="text-sm font-medium">
              Email Address
            </Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                disabled={!isEditing}
              />
              {user?.email && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Verified
                </span>
              )}
            </div>
          </div>

          {/* Account Created */}
          <div>
            <Label className="text-sm font-medium">Account Created</Label>
            <div className="mt-1 p-2 bg-gray-50 rounded text-sm text-gray-600">
              {user?.createdAt
                ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })
                : "Unknown"}
            </div>
          </div>

          {/* Last Sign In */}
          <div>
            <Label className="text-sm font-medium">Last Sign In</Label>
            <div className="mt-1 p-2 bg-gray-50 rounded text-sm text-gray-600">
              {user?.lastSignedIn
                ? formatDistanceToNow(new Date(user.lastSignedIn), { addSuffix: true })
                : "Unknown"}
            </div>
          </div>
        </div>
      </Card>

      {/* Account Security */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Security</h3>
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start">
            <Mail className="w-4 h-4 mr-2" />
            Change Email Address
          </Button>
          <Button variant="outline" className="w-full justify-start">
            Change Password
          </Button>
          <Button variant="outline" className="w-full justify-start">
            Enable Two-Factor Authentication
          </Button>
        </div>
      </Card>
    </div>
  );
}

/**
 * Preferences Tab
 */
function PreferencesTab({ user }: { user: UserType }) {
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    escalationAlerts: true,
    patternAlerts: true,
    weeklyDigest: false,
  });

  const handleToggle = (key: keyof typeof preferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <div className="space-y-6">
      {/* Notification Preferences */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
        <div className="space-y-4">
          {/* Email Notifications */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-gray-600">Receive updates via email</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.emailNotifications}
              onChange={() => handleToggle("emailNotifications" as const)}
              className="w-5 h-5 rounded"
            />
          </div>

          {/* Escalation Alerts */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">Escalation Alerts</p>
              <p className="text-sm text-gray-600">Notify when escalations are assigned</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.escalationAlerts}
              onChange={() => handleToggle("escalationAlerts" as const)}
              className="w-5 h-5 rounded"
            />
          </div>

          {/* Pattern Alerts */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">Pattern Alerts</p>
              <p className="text-sm text-gray-600">Notify about detected patterns</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.patternAlerts}
              onChange={() => handleToggle("patternAlerts" as const)}
              className="w-5 h-5 rounded"
            />
          </div>

          {/* Weekly Digest */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <p className="font-medium">Weekly Digest</p>
              <p className="text-sm text-gray-600">Receive weekly summary email</p>
            </div>
            <input
              type="checkbox"
              checked={preferences.weeklyDigest}
              onChange={() => handleToggle("weeklyDigest" as const)}
              className="w-5 h-5 rounded"
            />
          </div>
        </div>

        <Button className="w-full mt-6">Save Preferences</Button>
      </Card>

      {/* Privacy Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Privacy</h3>
        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start">
            Download My Data
          </Button>
          <Button variant="outline" className="w-full justify-start">
            Request Data Deletion
          </Button>
          <Button variant="outline" className="w-full justify-start">
            View Privacy Policy
          </Button>
        </div>
      </Card>
    </div>
  );
}
