import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.css';
import 'font-awesome/css/font-awesome.css';
import './index.css';
import App from './App';
import * as serviceWorker from './serviceWorker';

const domNode = document.getElementById('root');
if (!domNode) {
	throw new Error('No root element found');
}
const root = ReactDOM.createRoot(domNode);
root.render(<App />);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
