// Copyright 2011 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var traceur = (function () {
  'use strict';

  function compileAll() {
    // Code to handle automatically loading and running all scripts with type
    // text/traceur after the DOMContentLoaded event has fired.
    var scriptsToRun = [];
    var numPending = 0;

    function compileScriptsIfNonePending() {
      if (numPending == 0) {
        compileScripts();
      }
    }

    document.addEventListener('DOMContentLoaded', function() {
      var scripts = document.scripts;

      if (scripts.length <= 0) {
        return; // nothing to do
      }

      /* TODO: add traceur runtime library here
      scriptsToRun.push(
        { scriptElement: null,
          parentElement: scripts[0].parentElement,
          name: 'Runtime Library',
          contents: runtime });
      */

      for (var i = 0, length = scripts.length; i < length; i++) {
        var script = scripts[i];
        if (script.type == 'text/traceur' && !script.$jsppLoaded) {
          var entry = {
             scriptElement: script,
             parentElement: script.parentElement,
             name: script.src,
             contents: ''
          };

          scriptsToRun.push(entry);
          if (script.src.length == 0) {
            entry.contents = script.textContent;
            entry.name = document.location + ':' + i;
          } else {
            (function (boundEntry) {
              numPending++;
              var xhr = new XMLHttpRequest();
              xhr.open('GET', script.src);
              xhr.addEventListener('load', function(e) {
                if (xhr.status == 200 || xhr.status == 0) {
                  boundEntry.contents = xhr.responseText;
                }
                numPending--;
                compileScriptsIfNonePending();
              });
              var onFailure = function() {
                numPending--;
                console.warn('Failed to load', script.src);
                compileScriptsIfNonePending();
              };
              xhr.addEventListener('error', onFailure);
              xhr.addEventListener('abort', onFailure);
              xhr.send();
            })(entry);
          }
        }
      }
      compileScriptsIfNonePending();
    });

    function compileScripts() {
      for (var i = 0; i < scriptsToRun.length; i++) {
        var entry = scriptsToRun[i];
        var compiler = new traceur.Compiler();
        var result = compiler.compile(entry.contents);
        
        if (result.errors.length > 0) {
          console.warn("Traceur compilation errors", result.errors);
          continue;
        }

        var scriptElement = document.createElement('script');
        scriptElement.setAttribute('data-traceur-src-url', entry.name);
        scriptElement.textContent = result.result;

        var parent = entry.parentElement;
        parent.insertBefore(scriptElement,
                            entry.scriptElement || parent.firstChild);
      }
    }
  }
  compileAll();

  /**
   * Builds an object structure for the provided namespace path,
   * ensuring that names that already exist are not overwritten. For
   * example:
   * "a.b.c" -> a = {};a.b={};a.b.c={};
   * @param {string} name Name of the object that this file defines.
   * @private
   */
  function exportPath(name) {
    var parts = name.split('.');
    var cur = traceur;

    for (var part; parts.length && (part = parts.shift());) {
      if (part in cur) {
        cur = cur[part];
      } else {
        cur = cur[part] = {};
      }
    }
    return cur;
  };

  /**
   * @param {string} name
   * @param {!Function} fun
   */
  function define(name, fun) {
    var obj = exportPath(name);
    var exports = fun();
    for (var propertyName in exports) {
      // Maybe we should check the prototype chain here? The current usage
      // pattern is always using an object literal so we only care about own
      // properties.
      var propertyDescriptor = Object.getOwnPropertyDescriptor(exports,
                                                               propertyName);
      if (propertyDescriptor)
        Object.defineProperty(obj, propertyName, propertyDescriptor);
    }
  }

  function assert(b) {
    if (!b)
      throw Error('Assertion failed');
  }

  return {
    define: define,
    assert: assert
  };
})();