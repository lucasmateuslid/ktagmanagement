import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from './types';

export const AiMessageItem: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
    return (
        <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[95%] text-sm rounded-[18px] ${
                msg.role === 'user' 
                    ? 'bg-primary-500 text-black px-4 py-2.5 rounded-tr-sm shadow-md' 
                    : msg.role === 'tool'
                      ? 'w-full !max-w-full p-0 bg-transparent'
                      : 'bg-zinc-800 text-zinc-300 px-4 py-3 border border-zinc-700/50 rounded-tl-sm shadow-lg'
            }`}>
                {msg.role === 'user' ? (
                    <p className="text-[13px] font-semibold leading-snug">{msg.rawText}</p>
                ) : msg.role === 'tool' ? (
                    msg.content
                ) : (
                    <div className="text-[12px] font-medium leading-relaxed markdown-override space-y-3">
                        {typeof msg.content === 'string' ? (
                            <ReactMarkdown 
                                components={{
                                    strong: ({node, ...props}) => <span className="font-black text-white" {...props}/>,
                                    p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props}/>,
                                    ul: ({node, ...props}) => <ul className="list-disc pl-4 my-1 space-y-1.5 text-zinc-400" {...props}/>,
                                    li: ({node, ...props}) => <li {...props}/>,
                                }}
                            >
                                {msg.content}
                            </ReactMarkdown>
                        ) : msg.content}
                    </div>
                )}
            </div>
        </div>
    );
};
