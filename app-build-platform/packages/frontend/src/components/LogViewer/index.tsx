import React, { useEffect, useRef } from 'react';
import { Card } from 'antd';
import './LogViewer.css';

interface LogViewerProps {
  logs: string[];
}

const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    // 自动滚动到底部
    if (shouldAutoScrollRef.current && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (!logContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    // 如果用户滚动到底部附近，启用自动滚动
    shouldAutoScrollRef.current = isAtBottom;
  };

  return (
    <Card
      styles={{ body: { padding: 0 } }}
      style={{ backgroundColor: '#1e1e1e', borderRadius: '4px' }}
    >
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className="log-viewer"
        style={{
          height: '500px',
          overflow: 'auto',
          padding: '16px',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: '13px',
          lineHeight: '1.6',
          color: '#d4d4d4',
          backgroundColor: '#1e1e1e',
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#888' }}>暂无日志</div>
        ) : (
          logs.map((log, index) => (
            <div
              key={index}
              style={{
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                color: log.includes('[ERROR]') ? '#f48771' : '#d4d4d4',
              }}
            >
              {log}
            </div>
          ))
        )}
      </div>
    </Card>
  );
};

export default LogViewer;
