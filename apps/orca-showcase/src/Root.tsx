import "./index.css";
import { Composition } from "remotion";
import { MainShowcase } from "./MainShowcase";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="OrcaShowcase"
        component={MainShowcase}
        durationInFrames={8580} // 4.76 minutes (286 seconds * 30 fps)
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
