import { GraduationCap } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="landing-footer">
      <div className="brand">
        <span className="brand-mark">
          <GraduationCap size={20} />
        </span>
        <span>RusSra</span>
      </div>
      <p>Đồ án tốt nghiệp · WebRTC Collaborative Learning</p>
      <span>© 2026 RusSra</span>
    </footer>
  );
}

export default LandingFooter;
