import "./vscode.css";
import "./reset.css";
import "./styles.css";
import { useEffect, useState } from 'react';
import UI_MESSGAGES from './constansts';

export default function App() {
  const [isServerRunning, setIsServerRunning] = useState(false);

  useEffect(() => {
    const messageListener = (evt) => {
      const { type } = evt.data;

      switch (type) {
        case UI_MESSGAGES.START_DEV_SERVER: {
          setIsServerRunning(true);

          break;
        }
        case UI_MESSGAGES.STOP_DEV_SERVER: {
          setIsServerRunning(false);
        }
      }
    };

    window.addEventListener('message', messageListener);

    return () => window.removeEventListener('message', messageListener);
  }, []);

  return (
    <div>
      <div className="info-box">
        <p>Environment</p>
        <p>create-react-app</p>
      </div>
			<button>{isServerRunning? "Stop Dev Server": "Start Dev Server"}</button>
			<button className="mt-10">Export to Codesandbox</button>
    </div>
  );
}
