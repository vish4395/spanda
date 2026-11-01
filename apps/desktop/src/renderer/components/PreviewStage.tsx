import { useLayoutEffect, useRef, useState } from 'react';
import { MonitorIcon, PhoneIcon, TabletIcon } from './Icons';

export const DEVICES = [
  { id: 'desktop', label: 'Desktop', width: 1440, height: 900, Icon: MonitorIcon },
  { id: 'tablet', label: 'Tablet', width: 768, height: 1024, Icon: TabletIcon },
  { id: 'mobile', label: 'Mobile', width: 390, height: 844, Icon: PhoneIcon },
] as const;
export type DeviceId = (typeof DEVICES)[number]['id'];

export function PreviewStage({ url, device, title }: { url: string | null; device: DeviceId; title: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const spec = DEVICES.find((d) => d.id === device)!;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      const padding = 48;
      setScale(Math.max(0.1, Math.min(1, (stage.clientWidth - padding) / spec.width, (stage.clientHeight - padding) / spec.height)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [spec.width, spec.height]);

  return (
    <div className="stage" ref={stageRef}>
      {url ? (
        <div className="device" style={{ width: spec.width * scale, height: spec.height * scale }}>
          <iframe
            key={url}
            title={title}
            src={url}
            // Opaque origin, no same-origin access to the studio, no popups/forms/top navigation.
            sandbox="allow-scripts"
            referrerPolicy="no-referrer"
            style={{ width: spec.width, height: spec.height, transform: `scale(${scale})` }}
          />
        </div>
      ) : (
        <div className="empty">
          <MonitorIcon />
          <p className="empty__title">No preview yet</p>
          <p className="empty__body">Generate the project to build native HTML and React sites from its StorySpec.</p>
        </div>
      )}
    </div>
  );
}
