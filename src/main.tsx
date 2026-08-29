import { render } from 'preact'
import { App } from './app'
import './styles/base.css'

const root = document.getElementById('app')
if (!root) throw new Error('missing #app root')

// `index.html` ships a static description of the site inside this container:
// what a crawler that runs no JavaScript indexes, what a reader without it
// keeps, and what fills the page while this bundle downloads. It is emptied
// here rather than diffed against, because Preact would try to adopt those
// nodes and the reader would briefly see both pages at once.
root.replaceChildren()

render(<App />, root)
