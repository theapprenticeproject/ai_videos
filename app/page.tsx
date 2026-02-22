
'use client';
import PromptToVideoApp from './front'; // Pointing back to front.tsx as requested


console.log('PromptToVideoApp:', PromptToVideoApp);
console.log('Type is:', typeof PromptToVideoApp);

export default function Home() {
	return (
		<>
			<PromptToVideoApp />
		</>
	);
}

