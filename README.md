# PR Review Workflow
Below are the files that need to be created in order to run the PR review workflows.
1. Create [.github/pull_request_template.md](https://github.com/ajitsinghm/poc/blob/feature/work-flow/.github/pull_request_template.md) and prepare basic template which will used for PR review.
2. Create [.github/workflows/pr-reviews.yml](https://github.com/ajitsinghm/poc/blob/feature/work-flow/.github/workflows/pr-review.yml) file containes all the github actions which will automaticaly run as soon as PR is created.
This PR review will not automerge as given instruction in YML file, it required final review by human before merge.

