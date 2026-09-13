// SPDX-License-Identifier: GPL-3.0-only
import { render } from "preact";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("app");
if (root) render(<App />, root);
