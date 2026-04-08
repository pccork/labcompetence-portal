# Delete and Archive Rules

This document describes the current delete and archive behaviour for:

- departments
- sections / training units
- templates
- linked training records

It reflects the app rules currently implemented in the dashboard, backend routes,
and database migrations.

## Overview

The system now follows a simple rule:

- delete only when an item is empty and has no protected linked data
- archive when historical data must be preserved

For this reason:

- departments use soft archive
- sections use soft archive
- templates use soft archive or delete depending on usage
- training records use soft archive when their template is archived

## Department Rules

A department is the parent `labs` record under a hospital.

### Department can be deleted when

- it has no sections / training units linked to it

### Department cannot be deleted when

- it still contains one or more sections
- it therefore still has linked templates, assignments, or records through those sections

### Department archive behaviour

- if a department is not empty, it must be archived instead of deleted
- archived departments are hidden from normal active setup lists

### App areas

- global admin hospital setup
- department creation and department registry

## Section Rules

A section is a `training_units` record under a department.

### Section can be deleted when

- it has no linked templates
- it has no linked training assignments
- it has no linked training records
- it has no linked POCT registration links
- it has no linked POCT requests

User-to-section assignment rows do not block delete on their own.

### Section cannot be deleted when

- any template exists in that section
- any assignment exists in that section
- any training record exists through a template in that section
- any POCT link or POCT request exists in that section

### Section archive behaviour

- a section cannot be archived while active templates still exist in that section
- a section cannot be archived while active training records still exist in that section
- templates in that section must be archived manually one by one first
- once all related templates are archived, the section may be archived

### User prompt guidance

When a user tries to delete or archive a section, the app now warns that:

- delete is blocked when linked data exists
- related templates should be archived first
- linked record history must be preserved

### App areas

- local setup
- lab section navigator

## Template Rules

A template is a `templates` record linked to one section / training unit.

### Template can be deleted when

- it has no training assignments
- it has no training records

This supports the common scenario where a coordinator creates a template by
mistake and no one has used it yet.

### Template cannot be deleted when

- one or more training assignments exist
- one or more training records exist

### Template archive behaviour

- if linked assignments or training records exist, the template must be archived instead of deleted
- archiving a template also archives all training records linked to that template
- archived templates stop appearing for new work but remain available for history

### App areas

- template setup
- template library

## Training Record Rules

Training records are historical evidence and should not be deleted as part of
normal dashboard management.

### Current behaviour

- training records are archived automatically when their template is archived
- archived records remain in the database for history
- they should not be used as a reason to allow delete of a template or section

## Current User Flow

### If a template was created by mistake

- delete it if there are no assignments and no training records
- archive it if any assignment or training record already exists

### If a section was created by mistake

- delete it if it has no linked template, assignment, record, or POCT data
- if linked templates exist, archive the templates first
- once no active linked template or active linked record remains, archive the section

### If a department was created by mistake

- delete it only if it has no sections
- otherwise archive it

## Database Support

The current archive rules depend on these soft-archive columns:

- `labs.is_active`
- `training_units.is_active`
- `training_records.is_active`

Related migrations:

- [012_add_department_and_section_archiving.sql](/home/peter-chuk/labcompetence-portal/apps/backend/db/migrations/012_add_department_and_section_archiving.sql)
- [013_add_training_record_archiving.sql](/home/peter-chuk/labcompetence-portal/apps/backend/db/migrations/013_add_training_record_archiving.sql)

## Deployment Note

After backend changes are deployed, the matching database migrations must also
be applied in each environment:

- local database
- Render database

Without the migrations, archive features for departments, sections, and records
will not behave correctly.

## Future Improvements

Possible next steps:

- add restore buttons in the UI for archived departments, sections, templates, and records
- show exact block reasons in the UI, for example counts of linked templates or records
- add an archive view screen so admins can review archived items without SQL
