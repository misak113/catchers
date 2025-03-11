import React from 'react';
import './CodeOfRules.css';

const codeOfRulesUrl = 'https://docs.google.com/document/d/e/2PACX-1vSbNvnp4OE6WxkiOWn1LSyAOjNx_D1y0p3Sr5dPkLt741PQoSkDZbQnY9PnARee0EObY2kF6l7vu7QU/pub?embedded=true';

export const CodeOfRules = () => {
	return <>
		<iframe className="code-of-rules" title="Stanovy" src={codeOfRulesUrl} />
	</>;
};
