import "./vscode.css";
import "./reset.css";
import "./styles.css";
import { useEffect, useState } from 'react';
import UI_MESSGAGES from './constansts';
import { FaPlay, FaStop } from 'react-icons/fa';
import { SiCodesandbox } from 'react-icons/si';
import { IoMdCreate } from 'react-icons/io';

const vscode = acquireVsCodeApi();

export default function App() {
  const [isServerRunning, setIsServerRunning] = useState(false);
  const [environment, setEnvironment] = useState(null);

  useEffect(() => {
    const messageListener = (evt) => {
      const { type } = evt.data;

      switch (type) {
        case UI_MESSGAGES.START_DEV_SERVER: {
          const { environment } = evt.data;

          setIsServerRunning(true);
          setEnvironment(environment);

          break;
        }
        case UI_MESSGAGES.STOP_DEV_SERVER: {
          setIsServerRunning(false);
        }
      }
    };

    window.addEventListener('message', messageListener);

    vscode.postMessage({
      type: UI_MESSGAGES.LOAD
    });

    return () => window.removeEventListener('message', messageListener);
  }, []);

  return (
    <div>
      <button onClick={() => {
        vscode.postMessage({
          type: UI_MESSGAGES.NEW_PROJECT
        })
      }}>
        <IoMdCreate />
        &nbsp;
        New Project
      </button>
			<button className="mt-10" onClick={() => {
        if (isServerRunning) {
          vscode.postMessage({
            type: UI_MESSGAGES.STOP_DEV_SERVER
          });
        } else {
          vscode.postMessage({
            type: UI_MESSGAGES.START_DEV_SERVER
          });
        }
      }}>
        {isServerRunning? <FaStop /> : <FaPlay />}
        &nbsp;
        {isServerRunning? "Stop Dev Server": "Start Dev Server"}
      </button>
			<button onClick={() => {
        vscode.postMessage({
          type: UI_MESSGAGES.EXPORT_SANDBOX
        });
      }} className="mt-10">
        <SiCodesandbox />
        &nbsp;
        Export to Codesandbox
      </button>
      {
        environment && (
          <div className="info-box">
            <p>Environment</p>
            <p>{environment}</p>
          </div>
        )
      }
    </div>
  );
}
