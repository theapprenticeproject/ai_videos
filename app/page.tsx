
'use client';
import PromptToVideoApp from './front'; // ✅ now this matches


console.log('PromptToVideoApp:', PromptToVideoApp);
console.log('Type is:', typeof PromptToVideoApp);

export default function Home() {
	return (
		<>
				<PromptToVideoApp />
		</>
	);
}

