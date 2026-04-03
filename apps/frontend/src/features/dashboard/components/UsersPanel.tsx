import {
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  HospitalSummary,
  UserSummary,
} from "../api";

interface UsersPanelProps {
  hospitals: HospitalSummary[];
  users: UserSummary[];
  onCreateUser: (input: {
    hospitalId: number;
    name: string;
    email: string;
    password: string;
    role: string;
    staffType: string;
  }) => Promise<void>;
}

const roleOptions = [
  { value: "staff", label: "Staff" },
  { value: "trainer", label: "Trainer" },
  { value: "admin", label: "Training Co-ordinator / Admin" },
];

const staffTypeOptions = [
  { value: "basic_grade_scientist", label: "Basic Grade Scientist" },
  { value: "senior_medical_scientist", label: "Senior Medical Scientist" },
  { value: "medical_laboratory_aide", label: "Medical Laboratory Aide" },
  { value: "training_coordinator", label: "Training Co-ordinator" },
  { value: "poct_scientist", label: "POCT Scientist" },
  { value: "poct_medical_nursing", label: "POCT Medical/Nursing/Midwifery" },
];

const pocStaffTypes = new Set([
  "poct_scientist",
  "poct_medical_nursing",
]);

const directoryModes = [
  {
    value: "core",
    label: "Core lab staff",
    description: "Scientists, MLAs, trainers, and co-ordinators",
  },
  {
    value: "poc",
    label: "POC users",
    description: "POCT nurses, medics, midwives, and POCT scientists",
  },
] as const;

type DirectoryMode = (typeof directoryModes)[number]["value"];

export function UsersPanel({
  hospitals,
  users,
  onCreateUser,
}: UsersPanelProps) {
  const [hospitalId, setHospitalId] = useState(() => hospitals[0]?.id || 1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [role, setRole] = useState("staff");
  const [staffType, setStaffType] = useState("basic_grade_scientist");
  const [directoryMode, setDirectoryMode] = useState<DirectoryMode>("core");
  const [staffTypeFilter, setStaffTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const firstHospital = hospitals[0];

    if (!firstHospital) {
      return;
    }

    if (!hospitals.some((hospital) => hospital.id === hospitalId)) {
      setHospitalId(firstHospital.id);
    }
  }, [hospitalId, hospitals]);

  const visibleStaffTypeOptions = useMemo(
    () =>
      staffTypeOptions.filter((option) =>
        directoryMode === "poc"
          ? pocStaffTypes.has(option.value)
          : !pocStaffTypes.has(option.value)
      ),
    [directoryMode]
  );

  const filteredUsers = useMemo(() => {
    const normalizedSearchTerm = searchTerm.trim().toLowerCase();

    return users
      .filter((user) =>
        directoryMode === "poc"
          ? pocStaffTypes.has(user.staff_type)
          : !pocStaffTypes.has(user.staff_type)
      )
      .filter((user) =>
        staffTypeFilter === "all"
          ? true
          : user.staff_type === staffTypeFilter
      )
      .filter((user) => {
        if (!normalizedSearchTerm) {
          return true;
        }

        return `${user.name} ${user.email} ${user.hospital_name}`
          .toLowerCase()
          .includes(normalizedSearchTerm);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [directoryMode, searchTerm, staffTypeFilter, users]);

  useEffect(() => {
    setStaffTypeFilter("all");
  }, [directoryMode]);

  return (
    <section className="columns is-multiline">
      <div className="column is-5-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">People setup</p>
              <h2 className="title is-5">Create a user</h2>
            </div>
            <span className="tag is-info is-light">
              {hospitals.length} hospitals
            </span>
          </div>

          <form
            className="stacked-form"
            onSubmit={(event) => {
              event.preventDefault();
              setFormMessage(null);

              startTransition(() => {
                void onCreateUser({
                  hospitalId,
                  name,
                  email,
                  password,
                  role,
                  staffType,
                })
                  .then(() => {
                    setName("");
                    setEmail("");
                    setPassword("password123");
                    setRole("staff");
                    setStaffType("basic_grade_scientist");
                    setFormMessage("User created successfully.");
                  })
                  .catch((error) => {
                    setFormMessage(
                      error instanceof Error
                        ? error.message
                        : "Unable to create user"
                    );
                  });
              });
            }}
          >
            <div className="field">
              <label className="label" htmlFor="user-hospital">
                Hospital
              </label>
              <div className="select is-fullwidth">
                <select
                  id="user-hospital"
                  value={hospitalId}
                  onChange={(event) =>
                    setHospitalId(Number(event.target.value))
                  }
                >
                  {hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="user-name">
                Full name
              </label>
              <input
                id="user-name"
                className="input"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Jack Kenny"
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="user-email">
                Email
              </label>
              <input
                id="user-email"
                className="input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@hospital.ie"
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="user-password">
                Temporary password
              </label>
              <input
                id="user-password"
                className="input"
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="user-role">
                Permission role
              </label>
              <div className="select is-fullwidth">
                <select
                  id="user-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="user-staff-type">
                Staff type
              </label>
              <div className="select is-fullwidth">
                <select
                  id="user-staff-type"
                  value={staffType}
                  onChange={(event) => setStaffType(event.target.value)}
                >
                  {staffTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {formMessage ? (
              <p className="mini-note">{formMessage}</p>
            ) : null}

            <button
              className={`button is-link is-fullwidth ${
                isPending ? "is-loading" : ""
              }`}
              type="submit"
              disabled={isPending}
            >
              Create user
            </button>
          </form>
        </section>
      </div>

      <div className="column is-7-desktop">
        <section className="panel-card">
          <div className="panel-heading-row">
            <div>
              <p className="panel-kicker">Staff directory</p>
              <h2 className="title is-5">
                {directoryMode === "poc"
                  ? "POC users"
                  : "Core lab staff"}
              </h2>
            </div>
            <span className="tag is-success is-light">
              {filteredUsers.length} shown
            </span>
          </div>

          <div className="directory-controls">
            <div className="mode-toggle">
              {directoryModes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  className={`mode-toggle-button ${
                    directoryMode === mode.value ? "is-active" : ""
                  }`}
                  onClick={() => setDirectoryMode(mode.value)}
                >
                  <strong>{mode.label}</strong>
                  <small>{mode.description}</small>
                </button>
              ))}
            </div>

            <div className="columns is-mobile is-variable is-2">
              <div className="column is-7">
                <label className="label" htmlFor="user-search">
                  Search
                </label>
                <input
                  id="user-search"
                  className="input"
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search name, email, hospital"
                />
              </div>

              <div className="column is-5">
                <label className="label" htmlFor="staff-type-filter">
                  Staff type
                </label>
                <div className="select is-fullwidth">
                  <select
                    id="staff-type-filter"
                    value={staffTypeFilter}
                    onChange={(event) =>
                      setStaffTypeFilter(event.target.value)
                    }
                  >
                    <option value="all">All</option>
                    {visibleStaffTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="scroll-list user-list">
            {filteredUsers.length === 0 ? (
              <p className="empty-state">No users returned yet.</p>
            ) : (
              filteredUsers.map((user) => (
                <article className="list-card" key={user.id}>
                  <div>
                    <h3 className="list-title">{user.name}</h3>
                    <p className="list-meta">
                      {user.email} · {user.hospital_name}
                    </p>
                    <p className="mini-note">
                      {user.staff_type.replaceAll("_", " ")}
                    </p>
                  </div>

                  <span
                    className={`tag ${
                      user.role === "admin"
                        ? "is-danger"
                        : user.role === "trainer"
                          ? "is-warning"
                          : "is-link"
                    } is-light`}
                  >
                    {user.role}
                  </span>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
