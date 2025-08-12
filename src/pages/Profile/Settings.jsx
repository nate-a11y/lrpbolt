import NotificationSettingsCard from "../../components/NotificationSettingsCard.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

function ProfilePage() {
  const { user } = useAuth();
  return <NotificationSettingsCard user={user} />;
}
export default ProfilePage;
