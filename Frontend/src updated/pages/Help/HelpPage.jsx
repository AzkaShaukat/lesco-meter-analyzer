import TopBar from "../../components/layout/TopBar";
import Sidebar from "../../components/Sidebar/Sidebar";
import "./HelpPage.css";

const HelpPage = () => {
  return (
    <div className="help-page">
      <TopBar variant="report" showSearch={false} />
      <div className="help-container">
        <Sidebar activeItem="Help" />
        <main className="help-content">
          <h1>Help & Support</h1>
          <p>This page is under construction.</p>
          <p>Check back later for documentation and support resources.</p>
        </main>
      </div>
    </div>
  );
};

export default HelpPage;