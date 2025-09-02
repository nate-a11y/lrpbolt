import NotificationSettingsCard from "../../components/NotificationSettingsCard.jsx";
import PageContainer from "../../components/PageContainer.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

function ProfilePage() {
  const { user } = useAuth();
  return (
    <PageContainer>
      <NotificationSettingsCard user={user} />
    </PageContainer>
  );
}
export default ProfilePage;
