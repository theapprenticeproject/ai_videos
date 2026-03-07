
'use client';
import PromptToVideoApp from './front'; // Pointing back to front.tsx as requested



// Removed logs that were causing dev server crashes on Windows

export default function Home() {
	return (
		<>
			<PromptToVideoApp />
		</>
	);
}

